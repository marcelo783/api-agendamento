import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Paciente, PacienteDocument } from './paciente.schema';
import { CreatePacienteDto } from './dto/creat-paciente.dto';

@Injectable()
export class PacienteService {
  constructor(
    @InjectModel(Paciente.name) private pacienteModel: Model<PacienteDocument>,
  ) {}

  async create(createPacienteDto: CreatePacienteDto): Promise<Paciente> {
    const createdPaciente = new this.pacienteModel(createPacienteDto);
    return createdPaciente.save();
  }

  async findAll(): Promise<Paciente[]> {
    return this.pacienteModel.find().exec();
  }

  async findOne(id: string): Promise<Paciente> {
    return this.pacienteModel.findById(id).exec();
  }

  async update(id: string, updatePacienteDto: CreatePacienteDto): Promise<Paciente> {
    const paciente = await this.pacienteModel.findById(id).exec();

    if (!paciente) {
      throw new BadRequestException('Paciente não encontrado');
    }

    Object.assign(paciente, updatePacienteDto);

    return paciente.save();
  }

  async delete(id: string): Promise<Paciente> {
    return this.pacienteModel.findByIdAndDelete(id).exec();
  }
}