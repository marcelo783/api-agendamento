import {
  Injectable,
  OnModuleInit,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Agendamento, AgendamentoDocument } from './agendamento.schema';
import { Paciente, PacienteDocument } from '../paciente/paciente.schema';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { addSeconds, parseISO } from 'date-fns';
import * as cron from 'node-cron';

@Injectable()
export class AgendamentoService implements OnModuleInit {
  private readonly logger = new Logger(AgendamentoService.name);

  constructor(
    @InjectModel(Agendamento.name) private agendamentoModel: Model<AgendamentoDocument>,
    @InjectModel(Paciente.name) private pacienteModel: Model<PacienteDocument>,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing cron job...');
    cron.schedule('* * * * *', async () => {
      this.logger.log('Running cron job...');
      await this.expireOldAgendamentos();
    });
  }

  async getDisponibilidade(psicologoId: string): Promise<any[]> {
    const agendamentos = await this.agendamentoModel.find({ psicologo: psicologoId, status: 'disponivel' }).exec();
    return agendamentos.map(agendamento => agendamento.disponibilidade).flat();
  }

  async createAgendamento(createAgendamentoDto: CreateAgendamentoDto): Promise<Agendamento> {
    const { psicologoId, horario, formatoConsulta, pacienteNome, pacienteEmail, pacienteTelefone } = createAgendamentoDto;

    const horarioDate = new Date(horario);
    const horarioDia = horarioDate.toISOString().split('T')[0];
    const horarioHora = horarioDate.toTimeString().split(' ')[0].slice(0, 5);

    const agendamentos = await this.agendamentoModel.find({
      psicologo: psicologoId,
      status: 'disponivel',
      formatoConsulta: formatoConsulta,
    }).exec();

    const agendamento = agendamentos.find(a =>
      a.disponibilidade.some(slot =>
        new Date(slot.dia).toISOString().split('T')[0] === horarioDia &&
        slot.horarios.some(h => h.inicio === horarioHora)
      )
    );

    if (!agendamento) {
      throw new BadRequestException('Horário não disponível');
    }

    let paciente = await this.pacienteModel.findOne({ email: pacienteEmail }).exec();
    if (!paciente) {
      paciente = new this.pacienteModel({ nome: pacienteNome, email: pacienteEmail, telefone: pacienteTelefone });
      await paciente.save();
    }

    agendamento.status = 'agendado';
    agendamento['paciente'] = paciente._id;

    return agendamento.save();
  }

  async create(agendamento: Agendamento): Promise<Agendamento> {
    const createdAgendamento = new this.agendamentoModel({
      ...agendamento,
      status: 'disponivel'
    });
    await createdAgendamento.save();

    if (agendamento.repete) {
      await this.createRepeatedAgendamentos(createdAgendamento);
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

    const updatedAgendamento = await this.agendamentoModel.findByIdAndUpdate(
      idAgendamento,
      { status: novoStatus },
      { new: true }
    ).exec();

    if (!updatedAgendamento) {
      throw new BadRequestException('Falha ao atualizar o status do agendamento');
    }

    this.logger.log(`Status do agendamento ${idAgendamento} atualizado para ${novoStatus}`);
    return updatedAgendamento;
  }

  private async createRepeatedAgendamentos(agendamento: AgendamentoDocument) {
    const newDisponibilidade = agendamento.disponibilidade.map((slot) => {
      const slotDate = typeof slot.dia === 'string' ? parseISO(slot.dia) : slot.dia;
      const newDia = addSeconds(slotDate, 60);
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

    this.logger.log(`Criando novo agendamento repetido para psicólogo ${agendamento.psicologo}`);
    await newAgendamento.save();
  }

  private async expireOldAgendamentos() {
    const now = new Date();
    const agendamentos = await this.agendamentoModel.find({ status: 'disponivel' }).exec();

    for (const agendamento of agendamentos) {
      const slot = agendamento.disponibilidade.find(slot => {
        const slotDate = new Date(slot.dia);
        const secondsDifference = Math.floor((now.getTime() - slotDate.getTime()) / 1000);
        return secondsDifference >= 60;
      });

      if (slot) {
        this.logger.log(`Expirando agendamento ${agendamento._id}`);
        await this.updateStatusAgendamentos('expirado', agendamento._id.toString());
      }
    }
  }
}
