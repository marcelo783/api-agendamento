import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { PsicologoDocument } from '../psicologo/psicologo.schema';
import { JwtService } from '@nestjs/jwt';


@Injectable()
export class AuthService {
  constructor(
    @InjectModel('Psicologo') private psicologoModel: Model<PsicologoDocument>,
    private jwtService: JwtService,
  ) {}

  // Realiza o login e gera os tokens
  async login(user: any) {
    const psicologo = await this.psicologoModel.findOne({ email: user.email });
  
    if (!psicologo) {
      // O usuário não está registrado
      const payload = {
        email: user.email,
        sub: 'tempId',
        firstName: user.firstName,
        picture: user.picture,
      };
  
      // Gera um token JWT interno (opcional) para identificar o usuário na aplicação
      const token = this.generateJwt(payload);
      return {
        isRegistered: false,
        token,
        accessToken: user.accessToken,   // Recebe o accessToken do Google
        refreshToken: user.refreshToken, // Recebe o refreshToken do Google
      };
    }
  
    // Se o psicólogo existir, cria o payload e gera o JWT
    const payload = {
      email: psicologo.email,
      nome: psicologo.nome,
      especialidade: psicologo.especialidade,
      registroProfissional: psicologo.registroProfissional,
      sub: psicologo._id,
      firstName: user.firstName,
      picture: user.picture,
    };
  
    const token = this.generateJwt(payload);
  
    return {
      isRegistered: true,
      token,
      accessToken: user.accessToken,   // Recebe o accessToken do Google
      refreshToken: user.refreshToken, // Recebe o refreshToken do Google
    };
  }

  // Gera o token JWT interno para a aplicação (não confundir com o Google OAuth tokens)
  generateJwt(payload: any): string {
    return this.jwtService.sign(payload);
  }
  async renewAccessToken(refreshToken: string) {
    try {
      const requestData = {
        client_id: process.env.GOOGLE_ID,
        client_secret: process.env.GOOGLE_SECRET,
        refresh_token: decodeURIComponent(refreshToken),
        grant_type: 'refresh_token',
      };
  
      console.log('Dados enviados ao Google:', requestData);
  
      const response = await axios.post('https://oauth2.googleapis.com/token', requestData);
  
      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error) {
      console.error('❌nt Erro ao renovar access token:', error.response?.data || error.message);
      throw new Error(' nt Erro ao renovar access token: ' + (error.response?.data || error.message));
    }
  }

  // Reautenticação usando o refreshToken para renovar accessToken e refreshToken
  async reautenticar(refreshToken: string) {
    try {
      // Usa o Google refreshToken para obter um novo accessToken
      const novoAccessToken = await this.renewAccessToken(refreshToken);

      return { accessToken: novoAccessToken, refreshToken };  // Retorna o novo accessToken
    } catch (error) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }
}