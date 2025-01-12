import {
  Injectable,
  OnModuleInit,
  Logger,
  BadRequestException,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Agendamento, AgendamentoDocument } from './agendamento.schema';
import { Paciente, PacienteDocument } from '../paciente/paciente.schema';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { addSeconds, parseISO } from 'date-fns';
import * as cron from 'node-cron';
import { CalendarService } from '../google-calendar/google-calendar.service';
import { AuthService } from '../auth/auth.service';

import { format } from 'date-fns-tz';
import mongoose, { Model } from 'mongoose';
import { Types } from 'mongoose';

@Injectable()
export class AgendamentoService implements OnModuleInit {
  private readonly logger = new Logger(AgendamentoService.name);

  constructor(
    @InjectModel(Agendamento.name)
    private agendamentoModel: Model<AgendamentoDocument>,
    @InjectModel(Paciente.name) private pacienteModel: Model<PacienteDocument>,
    private calendarService: CalendarService,
    @Inject(AuthService) // Inject using AuthService class type
    private readonly authService: AuthService, // Maintain the same type for the property
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing cron job...');
    cron.schedule('* * * * *', async () => {
      this.logger.log('Running cron job...');
      await this.expireOldAgendamentos();
    });
  }

  async getDisponibilidade(psicologoId: string): Promise<any[]> {
    const agendamentos = await this.agendamentoModel
      .find({ psicologo: psicologoId, status: 'disponivel' })
      .exec();
    return agendamentos
      .map((agendamento) => agendamento.disponibilidade)
      .flat();
  }

  async create(
    agendamento: Agendamento,
    accessToken: string,
  ): Promise<Agendamento> {
    const createdAgendamento = new this.agendamentoModel({
      ...agendamento,
      status: 'disponivel',
    });

    // Verifica se deve criar eventos repetidos
    if (agendamento.repete) {
      await this.createRepeatedAgendamentos(createdAgendamento);
    } else {
      await createdAgendamento.save();
    }

    // Criação de eventos no Google Calendar para cada slot de horário
    for (const disponibilidade of createdAgendamento.disponibilidade) {
      for (const horario of disponibilidade.horarios) {
        const event = {
          summary: createdAgendamento.titulo,
          description: createdAgendamento.descricao,
          start: {
            dateTime: `${disponibilidade.dia.toISOString().split('T')[0]}T${horario.inicio}:00`,
            timeZone: 'America/Sao_Paulo',
          },
          end: {
            dateTime: `${disponibilidade.dia.toISOString().split('T')[0]}T${horario.fim}:00`,
            timeZone: 'America/Sao_Paulo',
          },
          attendees: [], // Sem paciente no momento
        };

        // Tenta criar o evento no Google Calendar
        const calendarEvent = await this.calendarService.createEvent(
          event,
          accessToken,
        );

        // Se o evento foi criado, salva o ID no horário
        if (calendarEvent.id) {
          horario.googleCalendarId = calendarEvent.id;
        } else {
          throw new Error(
            `Erro ao criar evento no Google Calendar para o horário ${horario.inicio}-${horario.fim}`,
          );
        }
      }
    }

    // Salva o agendamento novamente com os IDs do Google Calendar
    await createdAgendamento.save();

    return createdAgendamento;
  }

  async findAll(): Promise<Agendamento[]> {
    return this.agendamentoModel.find().exec();
  }

  async findByPsicologo(psicologoId: string): Promise<Agendamento[]> {
    return this.agendamentoModel.find({ psicologo: psicologoId }).exec();
  }

  async findById(id: string): Promise<AgendamentoDocument> {
    return this.agendamentoModel.findById(id).exec();
  }

  async updateStatusAgendamentos(
    agendamentoId: string,
    horarioId: string,
    status: string,
    accessToken: string,
  ): Promise<any> {
    // Buscar o agendamento pelo ID
    const agendamento = await this.findById(agendamentoId);
    if (!agendamento) {
      throw new BadRequestException('Agendamento não encontrado');
    }
  
    // Encontrar o horário específico pelo ID
    const disponibilidade = agendamento.disponibilidade.find((disp) =>
      disp.horarios.some((hor) => hor._id.toString() === horarioId),
    );
  
    if (!disponibilidade) {
      throw new BadRequestException('Horário não encontrado');
    }
  
    const horario = disponibilidade.horarios.find(
      (hor) => hor._id.toString() === horarioId,
    );
  
    if (!horario) {
      throw new BadRequestException('Horário não encontrado');
    }
  
    // Atualizar o status do horário
    horario.status = status;
  
    // Salvar as alterações no banco de dados
    await agendamento.save();
  
    this.logger.log(
      `Status do horário ${horarioId} atualizado para ${status}`,
    );
  
    return agendamento;
  }
  
  

  private async createRepeatedAgendamentos(agendamento: AgendamentoDocument) {
    const newDisponibilidade = agendamento.disponibilidade.map((slot) => {
      const slotDate =
        typeof slot.dia === 'string' ? parseISO(slot.dia) : slot.dia;
      const newDia = addSeconds(slotDate, 3000);
      const formattedDia = newDia.toISOString().split('T')[0];

      return {
        dia: formattedDia,
        horarios: slot.horarios,
      };
    });

    const newAgendamento = new this.agendamentoModel({
      psicologo: agendamento.psicologo,
      titulo: agendamento.titulo,
      descricao: agendamento.descricao,
      formatoConsulta: agendamento.formatoConsulta,
      status: 'disponivel',
      valor: agendamento.valor,
      repete: true,
      disponibilidade: newDisponibilidade,
    });

    this.logger.log(
      `Criando novo agendamento repetido para psicólogo ${agendamento.psicologo}`,
    );
    await newAgendamento.save();
  }

  async findByGoogleCalendarId(googleCalendarId: string): Promise<Agendamento> {
    const agendamento = await this.agendamentoModel
      .findOne({ googleCalendarId })
      .exec();
    if (!agendamento) {
      throw new NotFoundException(
        `Agendamento com googleCalendarId ${googleCalendarId} não encontrado`,
      );
    }
    return agendamento;
  }

  // Função confirmando o agendamento
  async confirmarAgendamento(
    agendamentoDto: CreateAgendamentoDto,
    accessToken: string,
  ): Promise<any> {
    const {
      agendamentoId,
      pacienteNome,
      pacienteEmail,
      pacienteTelefone,
      horarioId,
    } = agendamentoDto;

    if (!accessToken) {
      throw new Error(
        'Access token não fornecido para confirmar o agendamento',
      );
    }

    // Cria um novo documento de paciente
    const paciente = new this.pacienteModel({
      nome: pacienteNome,
      email: pacienteEmail,
      telefone: pacienteTelefone,
    });

    const savedPaciente = await paciente.save();
    const pacienteId = savedPaciente._id as mongoose.Types.ObjectId;

    // Busca o agendamento e o horário especificado
    const agendamento = await this.agendamentoModel
      .findById(agendamentoId)
      .exec();
    if (!agendamento) throw new Error('Agendamento não encontrado');

    const disponibilidade = agendamento.disponibilidade.find((d) =>
      d.horarios.some((h) => h._id.toString() === horarioId),
    );

    if (!disponibilidade) throw new Error('Horário não encontrado');

    const horario = disponibilidade.horarios.find(
      (h) => h._id.toString() === horarioId,
    );
    if (!horario) throw new Error('Horário inválido');

    if (horario.status === 'agendado') {
      throw new Error('Horário já está agendado');
    }

    // Verifica se o horário possui um ID do Google Calendar
    if (!horario.googleCalendarId) {
      throw new Error(
        'O horário não possui um ID do Google Calendar associado',
      );
    }

    // Atualiza o horário com o status e o paciente
    horario.status = 'agendado';
    horario.paciente = pacienteId;

    // Atualiza o evento no Google Calendar
    const eventData = {
      summary: agendamento.titulo,
      description: agendamento.descricao,
      start: {
        dateTime: `${disponibilidade.dia.toISOString().split('T')[0]}T${horario.inicio}:00`,
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: `${disponibilidade.dia.toISOString().split('T')[0]}T${horario.fim}:00`,
        timeZone: 'America/Sao_Paulo',
      },
      attendees: [{ email: pacienteEmail }], // Adiciona o paciente ao evento
    };

    // Atualiza o evento no Google Calendar com as informações do paciente
    await this.calendarService.updateEvent(
      horario.googleCalendarId,
      eventData,
      accessToken,
    );

    // Salva o agendamento atualizado
    await agendamento.save();

    return {
      agendamento,
      message: 'Horário confirmado com sucesso!',
    };
  }

  async atualizarAgendamento(
    id: string,
    updateData: Partial<CreateAgendamentoDto>,
    accessToken: string,
  ): Promise<any> {
    const { titulo, descricao, formatoConsulta, disponibilidade } = updateData;
  
    const agendamento = await this.agendamentoModel.findById(id).exec();
    if (!agendamento) {
      throw new Error('Agendamento não encontrado');
    }
  
    // Atualizar título, descrição e formato
    if (titulo) agendamento.titulo = titulo;
    if (descricao) agendamento.descricao = descricao;
    if (formatoConsulta) agendamento.formatoConsulta = formatoConsulta;
  
    const horariosExistentes = agendamento.disponibilidade.flatMap(
      (d) => d.horarios,
    );
  
    if (disponibilidade && disponibilidade.length > 0) {
      for (const novaDisp of disponibilidade) {
        const diaExistente = agendamento.disponibilidade.find(
          (disp) =>
            disp.dia.toISOString().split('T')[0] === novaDisp.dia,
        );
  
        if (diaExistente) {
          diaExistente.horarios = await Promise.all(
            novaDisp.horarios.map(async (novoHorario) => {
              const horarioExistente = diaExistente.horarios.find(
                (horario) =>
                  horario._id.toString() === novoHorario._id?.toString(),
              );
  
              if (horarioExistente) {
                horarioExistente.inicio = novoHorario.inicio;
                horarioExistente.fim = novoHorario.fim;
                horarioExistente.duracao = novoHorario.duracao;
                horarioExistente.status = novoHorario.status ?? 'disponivel';
                horarioExistente.paciente = novoHorario.paciente
                  ? new Types.ObjectId(novoHorario.paciente)
                  : null;
  
                if (horarioExistente.googleCalendarId) {
                  const eventData = {
                    summary: agendamento.titulo,
                    description: agendamento.descricao,
                    start: {
                      dateTime: `${novaDisp.dia}T${horarioExistente.inicio}:00`,
                      timeZone: 'America/Sao_Paulo',
                    },
                    end: {
                      dateTime: `${novaDisp.dia}T${horarioExistente.fim}:00`,
                      timeZone: 'America/Sao_Paulo',
                    },
                  };
  
                  await this.calendarService.updateEvent(
                    horarioExistente.googleCalendarId,
                    eventData,
                    accessToken,
                  );
                }
                return horarioExistente;
              }
  
              // Criar novo horário e evento no Google Calendar
              const newEventData = {
                summary: agendamento.titulo,
                description: agendamento.descricao,
                start: {
                  dateTime: `${novaDisp.dia}T${novoHorario.inicio}:00`,
                  timeZone: 'America/Sao_Paulo',
                },
                end: {
                  dateTime: `${novaDisp.dia}T${novoHorario.fim}:00`,
                  timeZone: 'America/Sao_Paulo',
                },
              };
  
              const calendarEvent = await this.calendarService.createEvent(
                newEventData,
                accessToken,
              );
  
              return {
                _id: new Types.ObjectId(),
                googleCalendarId: calendarEvent.id,
                inicio: novoHorario.inicio,
                fim: novoHorario.fim,
                duracao: novoHorario.duracao,
                status: novoHorario.status ?? 'disponivel',
                paciente: novoHorario.paciente
                  ? new Types.ObjectId(novoHorario.paciente)
                  : null,
              };
            }),
          );
        } else {
          throw new Error(
            `O dia ${novaDisp.dia} não foi encontrado no agendamento existente`,
          );
        }
      }
  
      // **Excluir horários que não estão mais na atualização**
      for (const horario of horariosExistentes) {
        const horarioRemovido = !disponibilidade.some((novaDisp) =>
          novaDisp.horarios.some(
            (novoHorario) =>
              novoHorario._id?.toString() === horario._id.toString(),
          ),
        );
  
        if (horarioRemovido && horario.googleCalendarId) {
          try {
            await this.calendarService.deleteEvent(
              horario.googleCalendarId,
              accessToken,
            );
          } catch (error) {
            console.error(
              `Erro ao deletar evento do Google Calendar com ID ${horario.googleCalendarId}:`,
              error.message,
            );
          }
        }
      }
    }
  
    // Salva o agendamento no banco
    await agendamento.save();
  
    return {
      agendamento,
      message: 'Agendamento atualizado com sucesso',
    };
  }
  
  
  

  // async deletarAgendamento(googleCalendarId: string, accessToken: string) {
  //   // Deletar evento no Google Calendar
  //   await this.calendarService.deleteEvent(googleCalendarId, accessToken);

  //   // Deletar agendamento no backend
  //   const agendamento = await this.agendamentoModel
  //     .findOne({ googleCalendarId })
  //     .exec();
  //   if (!agendamento) {
  //     throw new Error('Agendamento não encontrado');
  //   }

  //   await this.agendamentoModel.findOneAndDelete({ googleCalendarId }).exec();

  //   return { message: 'Agendamento deletado com sucesso' };
  // }

  // deletar por id
  async deletarAgendamentoPorId(
    id: string,
    accessToken: string,
  ): Promise<{ message: string }> {
    // Busca o agendamento no backend
    const agendamento = await this.agendamentoModel.findById(id).exec();
    if (!agendamento) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    for (const disponibilidade of agendamento.disponibilidade) {
      for (const horario of disponibilidade.horarios) {
        if (horario.googleCalendarId) {
          console.log(
            `Deletando evento com Google Calendar ID: ${horario.googleCalendarId}`,
          );
          try {
            await this.calendarService.deleteEvent(
              horario.googleCalendarId,
              accessToken,
            );
          } catch (error) {
            console.error(
              `Erro ao deletar evento do Google Calendar com ID ${horario.googleCalendarId}:`,
              error.message,
            );
          }
        } else {
          console.warn(
            `Horário sem Google Calendar ID: ${JSON.stringify(horario)}`,
          );
        }
      }
    }

    // Deleta o agendamento no backend
    await this.agendamentoModel.findByIdAndDelete(id).exec();

    return {
      message:
        'Agendamento deletado com sucesso no Google Calendar e no backend',
    };
  }

  // Filtrar agendamentos por título e/ou data
  async findAllWithFilters(
    titulo?: string,
    data?: string,
  ): Promise<Agendamento[]> {
    const filter: any = {};

    // Filtro de título
    if (titulo) {
      filter.titulo = { $regex: titulo, $options: 'i' };
    }

    // Filtro de data como intervalo (do início ao fim do dia)
    if (data) {
      const startDate = new Date(data);
      startDate.setUTCHours(0, 0, 0, 0); // Início do dia (meia-noite UTC)

      const endDate = new Date(data);
      endDate.setUTCHours(23, 59, 59, 999); // Fim do dia (23:59:59 UTC)

      filter['disponibilidade.dia'] = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    return this.agendamentoModel.find(filter).exec();
  }

  //
  private async expireOldAgendamentos() {
    const now = new Date();
    const agendamentos = await this.agendamentoModel
      .find({ status: 'disponivel' })
      .exec();
  
    for (const agendamento of agendamentos) {
      const expirado = agendamento.disponibilidade.find((slot) => {
        const slotDate = new Date(slot.dia);
        const secondsDifference = Math.floor(
          (now.getTime() - slotDate.getTime()) / 1000,
        );
        return secondsDifference >= 60;
      });
  
      if (expirado) {
        const horarioId = expirado.horarios?.[0]?._id; // Supondo que você queira expirar o primeiro horário
        if (!horarioId) {
          this.logger.warn(`Nenhum horário encontrado para expirar em ${agendamento._id}`);
          continue;
        }
  
        this.logger.log(`Expirando horário ${horarioId} do agendamento ${agendamento._id}`);
        
        const accessToken = 'SUA_LÓGICA_PARA_OBTER_ACCESS_TOKEN'; // Ajuste conforme sua lógica para obter o token
        
        await this.updateStatusAgendamentos(
          agendamento._id.toString(),
          horarioId.toString(),
          'expirado',
          accessToken,
        );
  
        await this.createRepeatedAgendamentos(agendamento);
      }
    }
  }
  
}
