import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PsicologoDocument = Psicologo & Document;

@Schema()
export class Psicologo {
  @Prop({ required: true })
  nome: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  senha: string;

  @Prop()
  telefone: string;

  @Prop()
  especialidade: string;

  @Prop()
  registroProfissional: string;

  @Prop({ required: true, unique: true })
  userName: string;

  @Prop({ default: null })
  lastUserNameChange: Date;

}

export const PsicologoSchema = SchemaFactory.createForClass(Psicologo);
