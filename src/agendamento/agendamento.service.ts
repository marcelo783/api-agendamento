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

  async create(agendamento: Agendamento): Promise<Agendamento> {
    const createdAgendamento = new this.agendamentoModel({
      ...agendamento,
      status: 'disponivel', // Mantém o status inicial
    });
  
    // Verifica se deve criar eventos repetidos
    if (agendamento.repete) {
      await this.createRepeatedAgendamentos(createdAgendamento);
    } else {
      await createdAgendamento.save();
    }
  
    return createdAgendamento; // Agora só salva no banco, sem criar no Google Calendar
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
    novoStatus: string,
    accessToken: string,
  ): Promise<any> {
    // Buscar o agendamento pelo ID
    const agendamento = await this.findById(agendamentoId);
    if (!agendamento) {
      throw new BadRequestException('Agendamento não encontrado');
    }
  
    // Encontrar a disponibilidade e o horário específicos
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
  
    // Atualizar o status do horário se ele for diferente do atual
    if (horario.status !== novoStatus) {
      horario.status = novoStatus;
    }
  
    // Recalcular os contadores de status baseado no estado atual dos horários
    const statusContador = {
      concluido: 0,
      cancelado: 0,
      ausente: 0,
      expirado: 0,
    };
  
    for (const disp of agendamento.disponibilidade) {
      for (const hor of disp.horarios) {
        if (hor.status in statusContador) {
          statusContador[hor.status as keyof typeof statusContador]++;
        }
      }
    }
  
    // Atualizar o statusContador no agendamento
    agendamento.statusContador = statusContador;
  
    // Salvar as alterações no banco de dados
    await agendamento.save();
  
    this.logger.log(
      `Status do horário ${horarioId} atualizado para ${novoStatus}`,
    );
  
    return agendamento;
  }

  //contador geral
  
  async calcularContadorGeral(): Promise<{
    concluido: number;
    cancelado: number;
    ausente: number;
    expirado: number;
  }> {
    // Inicializa os contadores gerais
    const contadorGeral = {
      concluido: 0,
      cancelado: 0,
      ausente: 0,
      expirado: 0,
    };
  
    // Recupera todos os agendamentos do banco
    const agendamentos = await this.agendamentoModel.find().exec();
  
    // Itera sobre cada agendamento e soma os valores do statusContador
    for (const agendamento of agendamentos) {
      contadorGeral.concluido += agendamento.statusContador?.concluido || 0;
      contadorGeral.cancelado += agendamento.statusContador?.cancelado || 0;
      contadorGeral.ausente += agendamento.statusContador?.ausente || 0;
      contadorGeral.expirado += agendamento.statusContador?.expirado || 0;
    }
  
    // Retorna o contador geral
    return contadorGeral;
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
    const { agendamentoId, pacienteNome, pacienteEmail, pacienteTelefone, horarioId } = agendamentoDto;
  
    if (!accessToken) {
      throw new Error('Access token não fornecido para confirmar o agendamento');
    }
  
    // Criar novo paciente
    const paciente = new this.pacienteModel({
      nome: pacienteNome,
      email: pacienteEmail,
      telefone: pacienteTelefone,
    });
    const savedPaciente = await paciente.save();
    const pacienteId = savedPaciente._id as mongoose.Types.ObjectId;
  
    // Buscar agendamento
    const agendamento = await this.agendamentoModel.findById(agendamentoId).exec();
    if (!agendamento) throw new Error('Agendamento não encontrado');
  
    // Encontrar horário correto
    const disponibilidade = agendamento.disponibilidade.find((d) =>
      d.horarios.some((h) => h._id.toString() === horarioId)
    );
    if (!disponibilidade) throw new Error('Horário não encontrado');
  
    const horario = disponibilidade.horarios.find(
      (h) => h._id.toString() === horarioId
    );
    if (!horario) throw new Error('Horário inválido');
  
    if (horario.status === 'agendado') {
      throw new Error('Horário já está agendado');
    }
  
    // Formatar data corretamente
    const formatDateTime = (date: Date, time: string) =>
      new Date(`${date.toISOString().split('T')[0]}T${time}:00`).toISOString();
    
  
    const eventData = {
      summary: agendamento.titulo,
      description: agendamento.descricao,
      start: {
        dateTime: formatDateTime(disponibilidade.dia, horario.inicio),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: formatDateTime(disponibilidade.dia, horario.fim),
        timeZone: 'America/Sao_Paulo',
      },
      attendees: [{ email: pacienteEmail }],
    };
  
    // Criar evento no Google Calendar
    const calendarEvent = await this.calendarService.createEvent(eventData, accessToken);
  
    // Atualizar horário com ID do Google Calendar e paciente
    horario.status = 'agendado';
    horario.paciente = pacienteId;
    horario.googleCalendarId = calendarEvent.id;
  
    // Salvar agendamento atualizado no banco
    await agendamento.save();
  
    return {
      agendamento,
      message: 'Horário confirmado e evento criado no Google Calendar com sucesso!',
    };
  }
  
  
  async atualizarAgendamento(
    id: string,
    updateData: Partial<CreateAgendamentoDto>,
    accessToken: string
  ): Promise<any> {
    const { titulo, descricao, formatoConsulta, disponibilidade } = updateData;
  
    // 🔍 Buscar o agendamento no banco
    const agendamento = await this.agendamentoModel.findById(id).exec();
    if (!agendamento) {
      throw new Error("Agendamento não encontrado");
    }
  
    // ✅ Atualizar título, descrição e formato da consulta
    if (titulo) agendamento.titulo = titulo;
    if (descricao) agendamento.descricao = descricao;
    if (formatoConsulta) agendamento.formatoConsulta = formatoConsulta;
  
    // 📌 LOG para verificar os horários ANTES da atualização
    console.log("📌 Agendamento encontrado:", agendamento.titulo);
    console.log("📌 googleCalendarId dos horários antes da atualização:");
    for (const disponibilidade of agendamento.disponibilidade) {
      for (const horario of disponibilidade.horarios) {
        console.log(
          `🕒 Horário: ${horario.inicio} - ${horario.fim} | Google ID: ${horario.googleCalendarId || "undefined"}`
        );
      }
    }
  
    // ✅ Atualizar evento no Google Calendar caso já tenha sido criado
    for (const disp of agendamento.disponibilidade) {
      for (const horario of disp.horarios) {
        if (horario.googleCalendarId) {
          try {
            // ✅ Garante que `disp.dia` é uma data válida
            const diaFormatado = new Date(disp.dia).toISOString().split("T")[0];
  
            const eventData = {
              summary: titulo || agendamento.titulo,
              description: descricao || agendamento.descricao,
              start: {
                dateTime: new Date(`${diaFormatado}T${horario.inicio}:00`).toISOString(),
                timeZone: "America/Sao_Paulo",
              },
              end: {
                dateTime: new Date(`${diaFormatado}T${horario.fim}:00`).toISOString(),
                timeZone: "America/Sao_Paulo",
              },
            };
  
            console.log(`🔄 Atualizando evento ${horario.googleCalendarId} no Google Calendar...`);
            await this.calendarService.updateEvent(
              horario.googleCalendarId,
              eventData,
              accessToken
            );
            console.log(`✅ Evento ${horario.googleCalendarId} atualizado com sucesso no Google Calendar.`);
          } catch (error) {
            console.error(`❌ Erro ao atualizar evento no Google Calendar:`, error.message);
          }
        }
      }
    }
  
    // ✅ Atualizar horários no banco de dados
    if (disponibilidade && disponibilidade.length > 0) {
      // 🛑 Criamos um Set com os IDs dos horários novos
      const novosHorariosIds = new Set(
        disponibilidade.flatMap((d) => d.horarios.map((h) => h._id?.toString()))
      );
  
      // 🔥 Remover horários que não estão na nova lista
      for (const disp of agendamento.disponibilidade) {
        disp.horarios = disp.horarios.filter((h) =>
          novosHorariosIds.has(h._id?.toString())
        );
      }
  
      // 🔄 Atualizar ou adicionar horários
      for (const novaDisp of disponibilidade) {
        let diaExistente = agendamento.disponibilidade.find(
          (disp) => disp.dia.toISOString().split("T")[0] === novaDisp.dia
        );
  
        if (!diaExistente) {
          diaExistente = {
            dia: new Date(novaDisp.dia),
            horarios: [],
          };
          agendamento.disponibilidade.push(diaExistente);
        }
  
        for (const novoHorario of novaDisp.horarios) {
          let horarioExistente = diaExistente.horarios.find(
            (horario) => horario._id?.toString() === novoHorario._id?.toString()
          );
  
          if (horarioExistente) {
            if (horarioExistente.status !== "agendado") {
              horarioExistente.inicio = novoHorario.inicio;
              horarioExistente.fim = novoHorario.fim;
              horarioExistente.duracao = novoHorario.duracao;
              horarioExistente.status = novoHorario.status ?? horarioExistente.status;
              horarioExistente.paciente = novoHorario.paciente
                ? new Types.ObjectId(novoHorario.paciente)
                : horarioExistente.paciente;
            }
          } else {
            diaExistente.horarios.push({
              _id: new Types.ObjectId(),
              inicio: novoHorario.inicio,
              fim: novoHorario.fim,
              duracao: novoHorario.duracao,
              status: novoHorario.status ?? "disponivel",
              paciente: novoHorario.paciente ? new Types.ObjectId(novoHorario.paciente) : null,
              googleCalendarId: undefined, // Só adiciona se o paciente confirmar
            });
          }
        }
      }
    }
  
    // 🔥 Salvar o agendamento atualizado no banco de dados
    await agendamento.save();
  
    return {
      agendamento,
      message: "Agendamento atualizado com sucesso",
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
