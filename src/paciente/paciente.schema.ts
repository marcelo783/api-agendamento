import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PacienteDocument = Paciente & Document;

@Schema()
export class Paciente {
  @Prop({ required: true })
  nome: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  telefone: string;

}

export const PacienteSchema = SchemaFactory.createForClass(Paciente);
