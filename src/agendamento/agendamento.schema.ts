import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { Psicologo } from '../psicologo/psicologo.schema';
import { Paciente } from 'src/paciente/paciente.schema';

export type AgendamentoDocument = Agendamento & Document;

@Schema()
export class Agendamento {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Psicologo', required: true })
  psicologo: Psicologo;

  @Prop({ required: false })
  googleCalendarId: string;

  @Prop({ required: true })
  titulo: string;

  @Prop({ required: true })
  descricao: string;

  @Prop({ type: String, enum: ['online', 'presencial'], required: true })
  formatoConsulta: string;

  @Prop({ type: String, enum: ['disponivel', 'cancelado', 'concluido', 'ausente', 'expirado', 'agendado'], required: false })
  status: string;

  @Prop({ required: true })
  valor: number;

  @Prop({ required: true })
  repete: boolean;

  @Prop({
    type: [
      {
        dia: { type: Date, required: true },
        horarios: [
          {
            _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
            reservado: { type: Boolean, default: false },
            paciente: { type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: false },
            inicio: { type: String, required: true },
            fim: { type: String, required: true },
            duracao: { type: Number, required: true },
          }
        ]
      }
    ],
    required: true
  })
  disponibilidade: Array<{
    dia: Date;
    horarios: Array<{
      _id: Types.ObjectId;
      reservado: boolean;
      inicio: string;
      fim: string;
      duracao: number;
      paciente: mongoose.Schema.Types.ObjectId; // Usar ObjectId para referência
    }>;
  }>;
}

export const AgendamentoSchema = SchemaFactory.createForClass(Agendamento);
