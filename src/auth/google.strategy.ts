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
      accessType: 'offline',
      prompt: 'consent',
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string | undefined,  // 🔍 Verificar se o refreshToken está sendo enviado
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    console.log('AccessToken recebido:', accessToken);
    console.log('RefreshToken recebido:', refreshToken || '❌ Não recebido');

    if (!refreshToken) {
      // ⚠️ Se não houver refreshToken, você pode tentar buscá-lo no banco de dados
      console.log('⚠️ Nenhum refreshToken recebido, verificando no banco de dados...');
      const storedTokens = await this.authService.gerarTokens(profile.emails[0].value);
      if (storedTokens) {
        refreshToken = storedTokens.refreshToken;  // Reutilize o refreshToken salvo
        console.log('🔄 Usando refreshToken armazenado:', refreshToken);
      } else {
        console.error('❌ Nenhum refreshToken disponível para o usuário.');
      }
    }

    const { name, emails, photos } = profile;

    const user = {
      email: emails[0].value,
      firstName: name.familyName,
      picture: photos[0].value,
      accessToken,
      refreshToken,  // Armazena o refresh token
    };

    // Gera o JWT e passa para o usuário
    const jwt = await this.authService.login(user);
    done(null, { ...user, jwt });
  }
}
