import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Psicologo, PsicologoDocument } from './psicologo.schema';
import { CreatePsicologoDto } from './dto/creat-psicologo.dto';

@Injectable()
export class PsicologoService {
  constructor(
    @InjectModel(Psicologo.name) private psicologoModel: Model<PsicologoDocument>,
  ) {}

  async create(createPsicologoDto: CreatePsicologoDto): Promise<Psicologo> {
    const createdPsicologo = new this.psicologoModel(createPsicologoDto);
    return createdPsicologo.save();
  }

  async findAll(): Promise<Psicologo[]> {
    return this.psicologoModel.find().exec();
  }

  async findOne(id: string): Promise<Psicologo> {
    return this.psicologoModel.findById(id).exec();
  }

  async update(id: string, updatePsicologoDto: CreatePsicologoDto): Promise<Psicologo> {
    const psicologo = await this.psicologoModel.findById(id).exec();

    if (!psicologo) {
      throw new BadRequestException('Psicólogo não encontrado');
    }

    Object.assign(psicologo, updatePsicologoDto);

    return psicologo.save();
  }

  async delete(id: string): Promise<Psicologo> {
    return this.psicologoModel.findByIdAndDelete(id).exec();
  }
}