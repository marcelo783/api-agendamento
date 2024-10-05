import {
  Injectable,
  OnModuleInit,
  Logger,
  BadRequestException,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Agendamento, AgendamentoDocument } from './agendamento.schema';
import { Paciente, PacienteDocument } from '../paciente/paciente.schema';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { addSeconds, parseISO } from 'date-fns';
import * as cron from 'node-cron';
import { CalendarService } from '../google-calendar/google-calendar.service';
import { AuthService } from '../auth/auth.service';

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
    }else{
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

  async updateStatusAgendamentos(novoStatus: string, idAgendamento: string) {
    const agendamento: AgendamentoDocument = await this.findById(idAgendamento);
    

    if (!agendamento) {
      throw new BadRequestException('Agendamento não encontrado');
    }

    const updatedAgendamento = await this.agendamentoModel
      .findByIdAndUpdate(idAgendamento, { status: novoStatus }, { new: true })
      .exec();

    if (!updatedAgendamento) {
      throw new BadRequestException(
        'Falha ao atualizar o status do agendamento',
      );
    }

    this.logger.log(
      `Status do agendamento ${idAgendamento} atualizado para ${novoStatus}`,
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
    const agendamento = await this.agendamentoModel.findOne({ googleCalendarId }).exec();
    if (!agendamento) {
      throw new NotFoundException(`Agendamento com googleCalendarId ${googleCalendarId} não encontrado`);
    }
    return agendamento;
  }
  
  
 // Função confirmando o agendamento
 
 async confirmarAgendamento(agendamento: CreateAgendamentoDto) {
  const { agendamentoId, pacienteNome, pacienteEmail, pacienteTelefone } = agendamento;

  // Cria um novo documento de paciente
  const paciente = new this.pacienteModel({
    nome: pacienteNome,
    email: pacienteEmail,
    telefone: pacienteTelefone,
  });

  // Salva o paciente no banco de dados
  const savedPaciente = await paciente.save();
  const pacienteId = savedPaciente._id;

 // Atualiza o agendamento com as informações do paciente 
  const updatedAgendamento = await this.agendamentoModel
    .findByIdAndUpdate(agendamentoId, { paciente: pacienteId, status: 'agendado' }, { new: true })
    .exec();

    // Obtém o token de acesso do Google
  const accessToken = this.authService.getAccessToken();

  // Prepara os dados do agendamento para o Google Calendar
  const agendamentoData = {
    titulo: updatedAgendamento.titulo,
    descricao: updatedAgendamento.descricao,
    start: updatedAgendamento.disponibilidade[0].horarios[0].inicio,
    end: updatedAgendamento.disponibilidade[0].horarios[0].fim,
    dia: updatedAgendamento.disponibilidade[0].dia,
    pacienteEmail: savedPaciente.email,
  };

  const eventData = {
    summary: agendamentoData.titulo,
    description: agendamentoData.descricao,
    start: {
      dateTime: new Date(`${agendamentoData.dia.toISOString().split('T')[0]}T${agendamentoData.start}:00`).toISOString(),
      timeZone: 'America/Sao_Paulo',
    },
    end: {
      dateTime: new Date(`${agendamentoData.dia.toISOString().split('T')[0]}T${agendamentoData.end}:00`).toISOString(),
      timeZone: 'America/Sao_Paulo',
    },
    attendees: [
      { email: agendamentoData.pacienteEmail },
    ],
  };

  // Cria o evento no Google Calendar
  const calendarEvent = await this.calendarService.createEvent(eventData, accessToken);

   // Obtém o link do Google Meet, se disponível
  const meetLink = calendarEvent.conferenceData?.entryPoints?.find(entry => entry.entryPointType === 'video')?.uri;

  console.log('Google Meet Link:', meetLink);

  

// Atualizar o agendamento com o ID do Google Calendar
  updatedAgendamento.googleCalendarId = calendarEvent.id;
  await updatedAgendamento.save();


  return {
    agendamento: updatedAgendamento,
    calendarEvent: calendarEvent,
  };
}

async atualizarAgendamento(googleCalendarId: string, updateData: CreateAgendamentoDto, accessToken: string) {
  const { titulo, descricao, disponibilidade, pacienteEmail } = updateData;

  const agendamento = await this.agendamentoModel.findOne({ googleCalendarId }).exec();
  if (!agendamento) {
    throw new Error('Agendamento não encontrado');
  }

  // Verifique se as datas e horários estão corretos
  const startDateTime = new Date(`${disponibilidade[0].dia}T${disponibilidade[0].horarios[0].inicio}:00`);
  const endDateTime = new Date(`${disponibilidade[0].dia}T${disponibilidade[0].horarios[0].fim}:00`);

  // Se a data ou o horário for inválido, lançará um erro
  if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
    throw new Error(`Data ou hora inválida. Verifique o formato das datas e horários. Recebido: ${disponibilidade[0].dia}, Início: ${disponibilidade[0].horarios[0].inicio}, Fim: ${disponibilidade[0].horarios[0].fim}`);
  }

  // Atualizar evento no Google Calendar
  const eventData = {
    summary: titulo,
    description: descricao,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: 'America/Sao_Paulo',
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: 'America/Sao_Paulo',
    },
    attendees: [
      { email: pacienteEmail },
    ],
  };

  const updatedCalendarEvent = await this.calendarService.updateEvent(googleCalendarId, eventData, accessToken);

  // Atualizar agendamento no backend
  agendamento.titulo = titulo;
  agendamento.descricao = descricao;
  agendamento.disponibilidade = disponibilidade.map(d => ({
    dia: new Date(d.dia),
    horarios: d.horarios
  }));
  await agendamento.save();

  return {
    agendamento,
    updatedCalendarEvent,
  };
}



// Atualizar agendamento por _id (sem Google Calendar)
async atualizarAgendamentoPorId(id: string, updateData: CreateAgendamentoDto) {
  // Atualizar agendamento no backend
  const agendamento = await this.agendamentoModel.findById(id).exec();
  if (!agendamento) {
    throw new NotFoundException('Agendamento não encontrado');
  }

  agendamento.titulo = updateData.titulo;
  agendamento.descricao = updateData.descricao;
  //agendamento.pacienteEmail = updateData.pacienteEmail;
  //agendamento.formatoConsulta = updateData.formatoConsulta;
 // agendamento.valor = updateData.valor;
  agendamento.disponibilidade = updateData.disponibilidade.map(d => ({
    dia: new Date(d.dia),
    horarios: d.horarios,
  }));

  await agendamento.save();

  return { message: 'Agendamento atualizado com sucesso', agendamento };
}



async deletarAgendamento(googleCalendarId: string, accessToken: string) {
  // Deletar evento no Google Calendar
  await this.calendarService.deleteEvent(googleCalendarId, accessToken);

  // Deletar agendamento no backend
  const agendamento = await this.agendamentoModel.findOne({ googleCalendarId }).exec();
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
async findAllWithFilters(titulo?: string, data?: string): Promise<Agendamento[]> {
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
        await this.createRepeatedAgendamentos(agendamento)
      }
    }
  }
}
