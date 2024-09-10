import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Paciente, PacienteDocument } from './paciente.schema';
import { CreatePacienteDto } from './dto/creat-paciente.dto';

@Injectable()
export class PacienteService {
  constructor(
    @InjectModel(Paciente.name) private pacienteModel: Model<PacienteDocument>,
  ) {}

  // Método para buscar um paciente pelo ID
  async findOne(id: string): Promise<Paciente> {
    const paciente = await this.pacienteModel.findById(id).exec();
    if (!paciente) {
      throw new NotFoundException(`Paciente com ID ${id} não encontrado`);
    }
    return paciente;
  }

  // Método para criar um novo paciente
  async create(createPacienteDto: CreatePacienteDto): Promise<Paciente> {
    const createdPaciente = new this.pacienteModel(createPacienteDto);
    return createdPaciente.save();
  }

  // Método para buscar todos os pacientes
  async findAll(): Promise<Paciente[]> {
    return this.pacienteModel.find().exec();
  }

  // Método para atualizar os dados de um paciente
  async update(id: string, updatePacienteDto: CreatePacienteDto): Promise<Paciente> {
    const paciente = await this.pacienteModel.findById(id).exec();

    if (!paciente) {
      throw new BadRequestException('Paciente não encontrado');
    }

    Object.assign(paciente, updatePacienteDto);

    return paciente.save();
  }

  // Método para deletar um paciente
  async delete(id: string): Promise<Paciente> {
    return this.pacienteModel.findByIdAndDelete(id).exec();
  }
}
