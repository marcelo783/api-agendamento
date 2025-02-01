import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/calendar'],
      accessType: 'offline', // Necessário para obter o refreshToken
      prompt: 'consent', // Força o consentimento para obter o refreshToken
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {

    console.log('AccessToken:', accessToken);
  console.log('RefreshToken:', refreshToken);
  console.log('Profile:', profile);

    const { name, emails, photos } = profile;

    // Obter o usuário e os tokens
    const user = {
      email: emails[0].value,
      firstName: name.familyName,
      picture: photos[0].value,
      accessToken,
      refreshToken,
    };

    console.log('AccessToken:', user.accessToken);
console.log('RefreshToken:', user.refreshToken);
console.log('User:', user);

    // Fazer login do usuário
    const jwt = await this.authService.login(user);
    Logger.log(jwt);

    done(null, { ...user, jwt });
  }
}
