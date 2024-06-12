import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Psicologo } from '../psicologo/psicologo.schema';

export type AgendamentoDocument = Agendamento & Document;

@Schema()
export class Agendamento {
  @Prop({ type: String, ref: 'Psicologo', required: true })
  psicologo: Psicologo;

  @Prop({ required: true })
  titulo: string;

  @Prop({ required: true })
  descricao: string;

  @Prop({ type: String, enum: ['online', 'presencial', 'hibrido'], required: true })
  formatoConsulta: string;

  @Prop({ type: String, enum: ['disponivel', 'cancelado', 'concluido', 'ausente','expirado', 'agendado'], required: true })
  status: string;
  

  @Prop({ required: true })
  valor: number;

  @Prop({ required: true })
  repete: boolean;

  @Prop({ type: [
    {
      dia: { type: Date, required: true },
      horarios: [
        {
          inicio: { type: String, required: true },
          fim: { type: String, required: true },
          duracao: { type: Number, required: true },
        }
      ]
    }
  ], required: true })
  disponibilidade: Array<{
    dia: Date;
    horarios: Array<{
      inicio: string;
      fim: string;
      duracao: number;
    }>
  }>;
}

export const AgendamentoSchema = SchemaFactory.createForClass(Agendamento);
