import { Module } from '@nestjs/common';
import { CalendarService } from './google-calendar.service';
import { CalendarController } from './google-calendar.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [CalendarService],
  controllers: [CalendarController],
  exports: [CalendarService], // Certifique-se de exportar o CalendarService
})
export class GoogleCalendarModule {}
