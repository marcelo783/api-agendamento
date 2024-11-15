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
import mongoose, { Model } from 'mongoose';
import { format } from 'date-fns-tz';


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
 
// Função confirmando o agendamento
async confirmarAgendamento(agendamentoDto: CreateAgendamentoDto) {
  const { agendamentoId, pacienteNome, pacienteEmail, pacienteTelefone, horarioId } = agendamentoDto;

  // Cria um novo documento de paciente
  const paciente = new this.pacienteModel({
    nome: pacienteNome,
    email: pacienteEmail,
    telefone: pacienteTelefone,
  });

  // Salva o paciente no banco de dados
  const savedPaciente = await paciente.save();
  const pacienteId = savedPaciente._id;

  // Busca o agendamento pelo ID e encontra o horário especificado
  const agendamento = await this.agendamentoModel.findById(agendamentoId).exec();
  if (!agendamento) throw new Error('Agendamento não encontrado');

  const disponibilidade = agendamento.disponibilidade.find(d => 
    d.horarios.some(h => h._id.toString() === horarioId)
  );

  if (!disponibilidade) throw new Error('Horário não encontrado');

  const horario = disponibilidade.horarios.find(h => h._id.toString() === horarioId);
  if (!horario) throw new Error('Horário inválido');

  // Atualiza o horário como reservado e associa ao paciente
  horario.reservado = true;
  horario.paciente = pacienteId as unknown as mongoose.Schema.Types.ObjectId;

  // Atualiza o agendamento com as informações do paciente e status
  agendamento.status = 'agendado';
  await agendamento.save();

  // Obtém o token de acesso do Google
  const accessToken = this.authService.getAccessToken();

  // Prepara os dados do agendamento para o Google Calendar
  const eventData = {
    summary: agendamento.titulo,
    description: agendamento.descricao,
    start: {
      dateTime: format(
        parseISO(`${disponibilidade.dia.toISOString().split('T')[0]}T${horario.inicio}:00`),
        "yyyy-MM-dd'T'HH:mm:ssXXX",
        { timeZone: 'America/Sao_Paulo' }
      ),
      timeZone: 'America/Sao_Paulo',
    },
    end: {
      dateTime: format(
        parseISO(`${disponibilidade.dia.toISOString().split('T')[0]}T${horario.fim}:00`),
        "yyyy-MM-dd'T'HH:mm:ssXXX",
        { timeZone: 'America/Sao_Paulo' }
      ),
      timeZone: 'America/Sao_Paulo',
    },
    attendees: [
      { email: pacienteEmail },
    ],
  };

  // Cria o evento no Google Calendar
  const calendarEvent = await this.calendarService.createEvent(eventData, accessToken);

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
  updateData: CreateAgendamentoDto, 
  accessToken: string
) {
  const { titulo, descricao, horarioId, status, formatoConsulta, pacienteEmail } = updateData;

  const agendamento = await this.agendamentoModel.findOne({ googleCalendarId }).exec();
  if (!agendamento) {
    throw new Error('Agendamento não encontrado');
  }

  // Encontre o horário específico pelo `horarioId`
  let horarioEscolhido = null;
  let diaEscolhido = null;

  // Iterar sobre as disponibilidades para encontrar o horário certo
  for (const disp of agendamento.disponibilidade) {
    const horario = disp.horarios.find(h => h._id?.toString() === horarioId);
    if (horario) {
      horarioEscolhido = horario;
      diaEscolhido = disp.dia;
      break;
    }
  }

  if (!horarioEscolhido) {
    throw new Error('Horário não encontrado ou inválido');
  }

  // Validação das horas
  const isValidHourFormat = (time: string) => /^\d{2}:\d{2}$/.test(time);
  if (!isValidHourFormat(horarioEscolhido.inicio) || !isValidHourFormat(horarioEscolhido.fim)) {
    throw new Error(`Formato de hora inválido. Início: ${horarioEscolhido.inicio}, Fim: ${horarioEscolhido.fim}`);
  }

  // Verificar se a data é válida
  const dia = diaEscolhido.toISOString().split('T')[0];
  const startDateTime = new Date(`${dia}T${horarioEscolhido.inicio}:00`);
  const endDateTime = new Date(`${dia}T${horarioEscolhido.fim}:00`);

  if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
    throw new Error(`Data ou hora inválida. Recebido: ${dia}, Início: ${horarioEscolhido.inicio}, Fim: ${horarioEscolhido.fim}`);
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

  // Atualizar informações no backend
  agendamento.titulo = titulo;
  agendamento.descricao = descricao;
  agendamento.status = status;
  agendamento.formatoConsulta = formatoConsulta;

  // Salvar alterações no MongoDB
  await agendamento.save();

  return {
    agendamento,
    updatedCalendarEvent,
  };
}




// Atualizar agendamento por _id (sem Google Calendar)
// Atualizar agendamento por _id (sem Google Calendar)
async atualizarAgendamentoPorId(id: string, updateData: CreateAgendamentoDto) {
  const agendamento = await this.agendamentoModel.findById(id).exec();
  if (!agendamento) {
    throw new NotFoundException('Agendamento não encontrado');
  }

  // Atualiza os campos básicos
  agendamento.titulo = updateData.titulo;
  agendamento.descricao = updateData.descricao;
  agendamento.status = updateData.status;

  // Atualiza a disponibilidade preservando os _id dos horários existentes
  agendamento.disponibilidade = updateData.disponibilidade.map((d) => {
    const existingDisponibilidade = agendamento.disponibilidade.find(
      (disp) => disp.dia.toISOString() === new Date(d.dia).toISOString()
    );

    return {
      dia: new Date(d.dia),
      horarios: d.horarios.map((h) => {
        const existingHorario = existingDisponibilidade?.horarios.find(
          (eh) => eh.inicio === h.inicio && eh.fim === h.fim
        );

        return {
          _id: existingHorario ? existingHorario._id : new mongoose.Types.ObjectId(),
          inicio: h.inicio,
          fim: h.fim,
          duracao: h.duracao,
          reservado: h.reservado || false,
          paciente: h.paciente
            ? (h.paciente as unknown as mongoose.Schema.Types.ObjectId)
            : null,
        };
      }),
    };
  });

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
