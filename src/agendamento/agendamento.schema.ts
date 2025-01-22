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

  

  @Prop({ required: true })
  valor: number;

  @Prop({ required: true })
  repete: boolean;

  @Prop({
    type: Object,
    default: {
      concluido: 0,
      cancelado: 0,
      ausente: 0,
      expirado: 0,
    },
  })
  statusContador: {
    concluido: number;
    cancelado: number;
    ausente: number;
    expirado: number;
  };

  
  @Prop({
    type: [
      {
        dia: { type: Date, required: true },
        horarios: [
          {
            _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
            status: {
              type: String,
              enum: ['disponivel', 'cancelado', 'concluido', 'ausente', 'expirado', 'agendado'],
              required: true,
            },
            paciente: { type: Types.ObjectId, ref: 'Paciente', required: false },
            inicio: { type: String, required: true },
            fim: { type: String, required: true },
            duracao: { type: Number, required: true },
            googleCalendarId: { type: String, required: false },
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
     status: string;
      inicio: string;
      fim: string;
      googleCalendarId?: string;
      duracao: number;
      paciente: Types.ObjectId; // Usar ObjectId para referência
    }>;
  }>;
}

export const AgendamentoSchema = SchemaFactory.createForClass(Agendamento);
