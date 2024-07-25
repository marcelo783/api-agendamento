import { Controller, Get, Post, Body, Req, Headers, UnauthorizedException } from '@nestjs/common';
import { CalendarService } from '../google-calendar/google-calendar.service';
import { calendar_v3 } from 'googleapis';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  async getEvents(@Headers('authorization') authHeader: string) {
    if (!authHeader) {
      throw new UnauthorizedException('Nenhum header de autorização fornecido.');
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Nenhum token de acesso encontrado no header de autorização.');
    }
    return this.calendarService.listEvents(token);
  }

  @Post('event')
  async createEvent(@Headers('authorization') authHeader: string, @Body() event: calendar_v3.Schema$Event) {
    if (!authHeader) {
      throw new UnauthorizedException('No authorization header provided.');
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('No access token found in authorization header.');
    }
    return this.calendarService.createEvent(event, token);
  }
}
