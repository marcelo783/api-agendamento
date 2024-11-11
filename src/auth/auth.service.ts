import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PsicologoDocument } from '../psicologo/psicologo.schema';

@Injectable()
export class AuthService {
  private accessToken: string;
  private oAuth2Client: OAuth2Client;

  constructor(
    private readonly jwtService: JwtService,
    @InjectModel('Psicologo') private psicologoModel: Model<PsicologoDocument>,
  ) {
    this.oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );
  }

  storeAccessToken(token: string) {
    this.accessToken = token;
  }

  getAccessToken() {
    return this.accessToken;
  }

  async isUserRegistered(email: string): Promise<boolean> {
    const user = await this.psicologoModel.findOne({ email }).exec();
    return !!user; // Retorna `true` se o usuário for encontrado, caso contrário, `false`
  }

  async login(user: any) {
    const psicologo = await this.psicologoModel.findOne({ email: user.email });

    // Obtenha o accessToken armazenado previamente
    const accessToken = this.getAccessToken();

    if (!psicologo) {
      // O usuário não está registrado. Gera um token JWT com um sub temporário
      const payload = {
        email: user.email,
        sub: 'tempId',
        firstName: user.firstName,
        picture: user.picture, 
      };
      const token = this.jwtService.sign(payload);
      return { isRegistered: false, token, accessToken }; 
    }

    
    const payload = {
      email: psicologo.email,
      nome: psicologo.nome,
      especialidade: psicologo.especialidade,
      registroProfissional: psicologo.registroProfissional,
      sub: psicologo._id,
      firstName: user.firstName, 
      picture: user.picture,
    };
    const token = this.jwtService.sign(payload);

    return {
      isRegistered: true,
      token,
      accessToken, 
    };
  }

  async getTokensFromCode(code: string): Promise<any> {
    const { tokens } = await this.oAuth2Client.getToken(code);
    this.storeAccessToken(tokens.access_token);
    return tokens;
  }
}
