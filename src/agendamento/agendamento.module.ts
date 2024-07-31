// agendamento.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgendamentoService } from './agendamento.service';
import { AgendamentoController } from './agendamento.controller';
import { Agendamento, AgendamentoSchema } from './agendamento.schema';
import { PacienteModule } from 'src/paciente/paciente.module';
import { GoogleCalendarModule } from 'src/google-calendar/google-calendar.module';
import { AuthModule } from '../auth/auth.module'; // Import AuthModule to make JwtService available

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Agendamento.name, schema: AgendamentoSchema }]),
    PacienteModule,
    forwardRef(() => GoogleCalendarModule),
    AuthModule, // Import AuthModule to make JwtService available
  ],

  controllers: [AgendamentoController],
  providers: [AgendamentoService],
  exports: [AgendamentoService]
})
export class AgendamentoModule {}
