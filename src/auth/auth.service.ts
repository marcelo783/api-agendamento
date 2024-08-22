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

    if (!psicologo) {
      throw new Error('Psicólogo não registrado.');
    }

    const payload = {
      email: psicologo.email,
      nome: psicologo.nome,
      especialidade: psicologo.especialidade,
      registroProfissional: psicologo.registroProfissional,
      sub: psicologo._id,
    };

    return {
      token: this.jwtService.sign(payload),
    };
  }

  async getTokensFromCode(code: string): Promise<any> {
    const { tokens } = await this.oAuth2Client.getToken(code);
    this.storeAccessToken(tokens.access_token);
    return tokens;
  }
}
