import { forwardRef, Module } from '@nestjs/common';
import { CalendarService } from './google-calendar.service';
import { CalendarController } from './google-calendar.controller';
import { AuthModule } from '../auth/auth.module';
import { AgendamentoModule } from 'src/agendamento/agendamento.module';

@Module({
  imports: [AuthModule, forwardRef(() => AgendamentoModule)],
  providers: [CalendarService],
  controllers: [CalendarController],
  exports: [CalendarService], // Certifique-se de exportar o CalendarService
})
export class GoogleCalendarModule {}
