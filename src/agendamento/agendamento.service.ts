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
      status: 'disponivel',
    });

    if (agendamento.repete) {
      await this.createRepeatedAgendamentos(createdAgendamento);
    } else {
      await createdAgendamento.save();
    }

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

  async updateStatusAgendamentos(status: string, idAgendamento: string) {
    const agendamento: AgendamentoDocument = await this.findById(idAgendamento);

    if (!agendamento) {
      throw new BadRequestException('Agendamento não encontrado');
    }

    const updatedAgendamento = await this.agendamentoModel
      .findByIdAndUpdate(idAgendamento, { status: status }, { new: true })
      .exec();

    if (!updatedAgendamento) {
      throw new BadRequestException(
        'Falha ao atualizar o status do agendamento',
      );
    }

    this.logger.log(
      `Status do agendamento ${idAgendamento} atualizado para ${status}`,
    );
    return updatedAgendamento;
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

 async confirmarAgendamento(agendamentoDto: CreateAgendamentoDto) {
  const {
    agendamentoId,
    pacienteNome,
    pacienteEmail,
    pacienteTelefone,
    horarioId,
  } = agendamentoDto;

  // Cria um novo documento de paciente
  const paciente = new this.pacienteModel({
    nome: pacienteNome,
    email: pacienteEmail,
    telefone: pacienteTelefone,
  });

  // Salva o paciente no banco de dados
  const savedPaciente = await paciente.save();
  const pacienteId = savedPaciente._id as mongoose.Types.ObjectId;

  // Busca o agendamento pelo ID e encontra o horário especificado
  const agendamento = await this.agendamentoModel.findById(agendamentoId).exec();
  if (!agendamento) throw new Error('Agendamento não encontrado');

  const disponibilidade = agendamento.disponibilidade.find((d) =>
    d.horarios.some((h) => h._id.toString() === horarioId),
  );

  if (!disponibilidade) throw new Error('Horário não encontrado');

  const horario = disponibilidade.horarios.find(
    (h) => h._id.toString() === horarioId,
  );
  if (!horario) throw new Error('Horário inválido');

  // Verifica se o horário já está agendado
  if (horario.status === 'agendado') {
    throw new Error('Horário já está agendado');
  }

  // Atualiza o horário com o ID do paciente e o status
  horario.status = 'agendado';
  horario.paciente = pacienteId; // Associa o paciente ao horário

  // Salva as alterações no agendamento antes de criar o evento no Google Calendar
  await agendamento.save();

  // Obtém o token de acesso do Google
  const accessToken = this.authService.getAccessToken();

  // Prepara os dados do agendamento para o Google Calendar
  const eventData = {
    summary: agendamento.titulo,
    description: agendamento.descricao,
    start: {
      dateTime: format(
        parseISO(
          `${disponibilidade.dia.toISOString().split('T')[0]}T${horario.inicio}:00`,
        ),
        "yyyy-MM-dd'T'HH:mm:ssXXX",
        { timeZone: 'America/Sao_Paulo' },
      ),
      timeZone: 'America/Sao_Paulo',
    },
    end: {
      dateTime: format(
        parseISO(
          `${disponibilidade.dia.toISOString().split('T')[0]}T${horario.fim}:00`,
        ),
        "yyyy-MM-dd'T'HH:mm:ssXXX",
        { timeZone: 'America/Sao_Paulo' },
      ),
      timeZone: 'America/Sao_Paulo',
    },
    attendees: [{ email: pacienteEmail }],
  };

  // Cria o evento no Google Calendar
  const calendarEvent = await this.calendarService.createEvent(
    eventData,
    accessToken,
  );

  // Atualiza o agendamento com o ID do Google Calendar
  agendamento.googleCalendarId = calendarEvent.id;
  await agendamento.save();

  return {
    agendamento,
    calendarEvent,
  };
}



  

  async atualizarAgendamento(
    googleCalendarId: string,
    updateData: Partial<CreateAgendamentoDto>,
    accessToken: string,
  ) {
    const { titulo, descricao, formatoConsulta, disponibilidade, pacienteEmail } = updateData;
  
    // Localizar o agendamento pelo Google Calendar ID
    const agendamento = await this.agendamentoModel.findOne({ googleCalendarId }).exec();
    if (!agendamento) {
      throw new Error('Agendamento não encontrado');
    }
  
    // Atualizar disponibilidade, se fornecida
    if (disponibilidade && disponibilidade.length > 0) {
      disponibilidade.forEach((novaDisp) => {
        const diaExistente = agendamento.disponibilidade.find(
          (disp) => disp.dia.toISOString() === new Date(novaDisp.dia).toISOString(),
        );
  
        if (diaExistente) {
          novaDisp.horarios.forEach((novoHorario) => {
            const horarioExistente = diaExistente.horarios.find(
              (horario) =>
                horario.inicio === novoHorario.inicio && horario.fim === novoHorario.fim,
            );
  
            if (horarioExistente) {
              horarioExistente.duracao = novoHorario.duracao ?? horarioExistente.duracao;
              horarioExistente.status = novoHorario.status ?? horarioExistente.status;
              horarioExistente.paciente = novoHorario.paciente ?? horarioExistente.paciente;
            } else {
              diaExistente.horarios.push({
                _id: new Types.ObjectId(),
                ...novoHorario,
                status: novoHorario.status ?? 'disponivel',
                paciente: novoHorario.paciente ?? null,
              });
            }
          });
        } else {
          agendamento.disponibilidade.push({
            dia: new Date(novaDisp.dia),
            horarios: novaDisp.horarios.map((horario) => ({
              _id: new Types.ObjectId(),
              ...horario,
              status: horario.status ?? 'disponivel',
              paciente: horario.paciente ?? null,
            })),
          });
        }
      });
    }
  
    // Validar o e-mail do participante
    if (!pacienteEmail) {
      throw new Error('E-mail do participante não encontrado');
    }
  
    // Atualizar evento no Google Calendar
    try {
      const diaAtual = disponibilidade
        ? disponibilidade[0].dia
        : agendamento.disponibilidade[0]?.dia;
      const horarioAtual = disponibilidade
        ? disponibilidade[0].horarios[0]
        : agendamento.disponibilidade[0]?.horarios[0];
  
      if (!diaAtual || !horarioAtual) {
        throw new Error('Horário e dia não disponíveis para atualizar o Google Calendar');
      }
  
      const eventData = {
        summary: titulo || agendamento.titulo,
        description: descricao || agendamento.descricao,
        start: {
          dateTime: new Date(`${new Date(diaAtual).toISOString().split('T')[0]}T${horarioAtual.inicio}:00`).toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: new Date(`${new Date(diaAtual).toISOString().split('T')[0]}T${horarioAtual.fim}:00`).toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        attendees: [{ email: pacienteEmail }],
      };
  
      const updatedCalendarEvent = await this.calendarService.updateEvent(
        googleCalendarId,
        eventData,
        accessToken,
      );
  
      // Atualizar os outros dados do agendamento no banco
      if (titulo) agendamento.titulo = titulo;
      if (descricao) agendamento.descricao = descricao;
      if (formatoConsulta) agendamento.formatoConsulta = formatoConsulta;
  
      await agendamento.save();
  
      return {
        agendamento,
        updatedCalendarEvent,
      };
    } catch (error) {
      console.error('Erro ao atualizar evento no Google Calendar:', error);
      throw new Error('Não foi possível atualizar o evento no Google Calendar');
    }
  }
  
  
  
  
  
  

  // Atualizar agendamento por _id (sem Google Calendar)
  async atualizarAgendamentoPorId(id: string, updateData: Partial<CreateAgendamentoDto>) {
    const {
      titulo,
      descricao,
      formatoConsulta,
      disponibilidade,
    } = updateData;
  
    // Buscar agendamento pelo ID
    const agendamento = await this.agendamentoModel.findById(id).exec();
    if (!agendamento) {
      throw new NotFoundException('Agendamento não encontrado');
    }
  
    // Atualizar apenas os campos fornecidos
    if (titulo) agendamento.titulo = titulo;
    if (descricao) agendamento.descricao = descricao;
  
    if (formatoConsulta) agendamento.formatoConsulta = formatoConsulta;
  
    // Atualizar disponibilidade, caso fornecida
   // Atualizar disponibilidade, caso fornecida
  if (disponibilidade && disponibilidade.length > 0) {
    disponibilidade.forEach((novaDisp) => {
      const diaExistente = agendamento.disponibilidade.find(
        (disp) => disp.dia.toISOString() === new Date(novaDisp.dia).toISOString(),
      );

      if (diaExistente) {
        // Atualizar horários do dia existente
        novaDisp.horarios.forEach((novoHorario) => {
          const horarioExistente = diaExistente.horarios.find(
            (horario) =>
              horario.inicio === novoHorario.inicio && horario.fim === novoHorario.fim,
          );

          if (horarioExistente) {
            // Atualizar dados do horário existente
            horarioExistente.duracao = novoHorario.duracao;
            horarioExistente.status = novoHorario.status ?? horarioExistente.status; // Substituição de reservado por status
            horarioExistente.paciente = novoHorario.paciente ?? horarioExistente.paciente;
          } else {
            // Adicionar novo horário ao dia existente
            diaExistente.horarios.push({
              _id: new Types.ObjectId(),
              ...novoHorario,
              status: novoHorario.status ?? 'disponivel', // Define um status padrão
              paciente: novoHorario.paciente ?? null,
            });
          }
        });
      } else {
        // Adicionar um novo dia com horários
        agendamento.disponibilidade.push({
          dia: new Date(novaDisp.dia),
          horarios: novaDisp.horarios.map((horario) => ({
            _id: new Types.ObjectId(),
            ...horario,
            status: horario.status ?? 'disponivel', // Define um status padrão
            paciente: horario.paciente ?? null,
          })),
        });
      }
    });
  }
  
    await agendamento.save();
  
    return {
      message: 'Agendamento atualizado com sucesso',
      agendamento,
    };
  }
  
  
  

  async deletarAgendamento(googleCalendarId: string, accessToken: string) {
    // Deletar evento no Google Calendar
    await this.calendarService.deleteEvent(googleCalendarId, accessToken);

    // Deletar agendamento no backend
    const agendamento = await this.agendamentoModel
      .findOne({ googleCalendarId })
      .exec();
    if (!agendamento) {
      throw new Error('Agendamento não encontrado');
    }

    await this.agendamentoModel.findOneAndDelete({ googleCalendarId }).exec();

    return { message: 'Agendamento deletado com sucesso' };
  }

  // deletar por id

  async deletarAgendamentoPorId(id: string) {
    const agendamento = await this.agendamentoModel.findById(id).exec();
    if (!agendamento) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    // Deletar agendamento no backend (não toca no Google Calendar)
    await this.agendamentoModel.findByIdAndDelete(id).exec();

    return { message: 'Agendamento deletado com sucesso' };
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
        this.logger.log(`Expirando agendamento ${agendamento._id}`);
        await this.updateStatusAgendamentos(
          'expirado',

          agendamento._id.toString(),
        ),
          await this.createRepeatedAgendamentos(agendamento);
      }
    }
  }
}
