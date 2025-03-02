import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';


@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_ID'),
      clientSecret: configService.get<string>('GOOGLE_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/calendar'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string | undefined,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    console.log("[GoogleStrategy] RefreshToken recebido do Google:", refreshToken);

    if (!refreshToken) {
      console.error('❌ Erro: Google não enviou um refreshToken. Verifique se a autenticação está correta.');
    }

    const user = {
      email: profile.emails[0].value,
      firstName: profile.name.givenName,
      lastName: profile.name.familyName,
      picture: profile.photos[0].value,
      accessToken,
      refreshToken, // ⭐ Aqui está o refreshToken do Google!
    };

    const jwt = await this.authService.login(user);

    // ⭐ Passe o refreshToken explicitamente:
    done(null, {
      ...user,
      jwt,
      refreshToken, // Garanta que o refreshToken está aqui!
    });
  }
}