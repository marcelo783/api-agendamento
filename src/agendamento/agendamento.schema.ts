import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Psicologo } from '../psicologo/psicologo.schema';
import { Paciente } from 'src/paciente/paciente.schema';
import { type } from 'os';

export type AgendamentoDocument = Agendamento & Document;

@Schema()
export class Agendamento {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'psicologo', required: true })
  psicologo: Psicologo;

  @Prop({ required: false })
  googleCalendarId: string

  @Prop({ required: true })
  titulo: string;

  @Prop({ required: true })
  descricao: string;

  @Prop({ type: String, enum: ['online', 'presencial'], required: true })
  formatoConsulta: string;

  @Prop({ type: String, enum: ['disponivel', 'cancelado', 'concluido', 'ausente','expirado', 'agendado'], required: false })
  status: string;
  
  // @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Paciente', required: false })
  // paciente: Paciente;



  @Prop({ required: true })
  valor: number;

  @Prop({ required: true })
  repete: boolean;

  @Prop({ type: [
    {
      dia: { type: Date, required: true },
      horarios: [
        {
          reservado: { type: Boolean, default:false},
          paciente: {type: Paciente, default: null, required: false},
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
      reservado: boolean;
      fim: string;
      duracao: number;
    }>
  }>;
  
}

export const AgendamentoSchema = SchemaFactory.createForClass(Agendamento);