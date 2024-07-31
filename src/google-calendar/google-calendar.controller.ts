import { Controller, Get, Post, Body, Headers, UnauthorizedException, Put, Param, Delete } from '@nestjs/common';
import { CalendarService } from '../google-calendar/google-calendar.service';
import { calendar_v3 } from 'googleapis';
import { CreateAgendamentoDto } from 'src/agendamento/dto/create-agendamento.dto';
import { AgendamentoService } from 'src/agendamento/agendamento.service';

@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly agendamentoService: AgendamentoService
  ) {}

  @Get('events')
  async getEvents(@Headers('authorization') authHeader: string) {
    const token = this.extractToken(authHeader);
    return this.calendarService.listEvents(token);
  }

  @Post('event')
  async createEvent(@Headers('authorization') authHeader: string, @Body() event: calendar_v3.Schema$Event) {
    const token = this.extractToken(authHeader);
    return this.calendarService.createEvent(event, token);
  }

  @Put('event/:googleCalendarId/:backendId')
  async updateEvent(
    @Headers('authorization') authHeader: string,
    @Param('googleCalendarId') googleCalendarId: string,
    @Param('backendId') backendId: string,
    @Body() updateData: CreateAgendamentoDto
  ) {
    const token = this.extractToken(authHeader);
    return this.agendamentoService.atualizarAgendamento(googleCalendarId, backendId, updateData, token);
  }

  @Delete('event/:googleCalendarId/:backendId')
  async deleteEvent(@Headers('authorization') authHeader: string, @Param('googleCalendarId') googleCalendarId: string, @Param('backendId') backendId: string) {
    const token = this.extractToken(authHeader);
    return this.agendamentoService.deletarAgendamento(googleCalendarId, backendId, token);
  }

  private extractToken(authHeader: string): string {
    if (!authHeader) {
      throw new UnauthorizedException('Nenhum cabeçalho de autorização fornecido.');
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Nenhum token de acesso encontrado no cabeçalho de autorização.');
    }
    return token;
  }
}
