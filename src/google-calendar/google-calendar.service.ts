import { Injectable, UnauthorizedException } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class CalendarService {
  private calendar: calendar_v3.Calendar;

  constructor(private readonly authService: AuthService) {
    this.calendar = google.calendar({ version: 'v3' });
  }

  generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ];
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL,
    ).generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });
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

//conferência do Google Meet ao criar o evento

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

  async getTokensFromCode(code: string): Promise<any> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );

    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  }
}
