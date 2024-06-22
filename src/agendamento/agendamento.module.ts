import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgendamentoService } from './agendamento.service';
import { AgendamentoController } from './agendamento.controller';
import { Agendamento, AgendamentoSchema } from './agendamento.schema';
import { PacienteModule } from 'src/paciente/paciente.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Agendamento.name, schema: AgendamentoSchema }]),
    PacienteModule
  ],
  controllers: [AgendamentoController],
  providers: [AgendamentoService],
})
export class AgendamentoModule {}