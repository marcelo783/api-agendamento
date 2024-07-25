import {
  Injectable,
  OnModuleInit,
  Logger,
  BadRequestException,
  Inject,
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

  

 // Função confirmando o agendamento
 
 async confirmarAgendamento(agendamento: CreateAgendamentoDto) {
  const { agendamentoId, pacienteNome, pacienteEmail, pacienteTelefone } = agendamento;

  const paciente = new this.pacienteModel({
    nome: pacienteNome,
    email: pacienteEmail,
    telefone: pacienteTelefone,
  });

  const savedPaciente = await paciente.save();
  const pacienteId = savedPaciente._id;

  const updatedAgendamento = await this.agendamentoModel
    .findByIdAndUpdate(agendamentoId, { paciente: pacienteId, status: 'agendado' }, { new: true })
    .exec();

  const accessToken = this.authService.getAccessToken();

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

  const calendarEvent = await this.calendarService.createEvent(eventData, accessToken);

  const meetLink = calendarEvent.conferenceData?.entryPoints?.find(entry => entry.entryPointType === 'video')?.uri;

  console.log('Google Meet Link:', meetLink);


  return {
    agendamento: updatedAgendamento,
    calendarEvent: calendarEvent,
  };
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
