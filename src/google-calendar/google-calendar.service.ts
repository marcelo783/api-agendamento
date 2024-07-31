import { Injectable, UnauthorizedException } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class CalendarService {
  private calendar: calendar_v3.Calendar;

  constructor(private readonly authService: AuthService) {
    this.calendar = google.calendar({ version: 'v3' });
  }

  async listEvents(accessToken: string): Promise<calendar_v3.Schema$Event[]> {
    if (!accessToken) {
      throw new UnauthorizedException('No access token set.');
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const res = await this.calendar.events.list({
      calendarId: 'primary',
      timeMin: (new Date()).toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return res.data.items || [];
  }

  async createEvent(event: calendar_v3.Schema$Event, accessToken: string): Promise<calendar_v3.Schema$Event> {
    if (!accessToken) {
      throw new UnauthorizedException('No access token set.');
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const eventWithConference = {
      ...event,
      conferenceData: {
        createRequest: {
          requestId: new Date().toISOString(), // Deve ser único para cada solicitação
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
      attendees: [
        { email: event.attendees[0].email } // Certifique-se de incluir os e-mails dos convidados
      ],
    };

    const res = await this.calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventWithConference,
      conferenceDataVersion: 1,
      sendUpdates: 'all', // Garante que e-mails de atualização sejam enviados
    });

    return res.data;
  }

  async updateEvent(eventId: string, event: calendar_v3.Schema$Event, accessToken: string): Promise<calendar_v3.Schema$Event> {
    if (!accessToken) {
      throw new UnauthorizedException('No access token set.');
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const res = await this.calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      requestBody: event,
      sendUpdates: 'all',
    });

    return res.data;
  }

  async deleteEvent(eventId: string, accessToken: string): Promise<void> {
    if (!accessToken) {
      throw new UnauthorizedException('No access token set.');
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await this.calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
      sendUpdates: 'all',
    });
  }
}
