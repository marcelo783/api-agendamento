import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PsicologoDocument } from '../psicologo/psicologo.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel('Psicologo') private psicologoModel: Model<PsicologoDocument>,
  ) {}

  
  // Gera accessToken e refreshToken
  async gerarTokens(email: string) {
    const accessToken = this.jwtService.sign({ email }, { secret: process.env.JWT_SECRET, expiresIn: '30m' });
    const refreshToken = this.jwtService.sign({ email }, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d' });

    return { accessToken, refreshToken };
  }

  // Realiza o login e gera os tokens
  async login(user: any) {
    const psicologo = await this.psicologoModel.findOne({ email: user.email });
  
    if (!psicologo) {
      // O usuário não está registrado, então NÃO use um `_id` inexistente.
      const payload = {
        email: user.email,
        sub: 'tempId',//  Garante que o sub não seja undefined
        firstName: user.firstName,
        picture: user.picture,
      };
      const token = this.jwtService.sign(payload);
      return { isRegistered: false, token, accessToken: user.accessToken, refreshToken: user.refreshToken };
    }
  
    // Se o psicólogo existir, então pode usar o `_id`
    const payload = {
      email: psicologo.email,
      nome: psicologo.nome,
      especialidade: psicologo.especialidade,
      registroProfissional: psicologo.registroProfissional,
      sub: psicologo._id, //  Agora temos certeza que existe
      firstName: user.firstName,
      picture: user.picture,
    };
  
    const token = this.jwtService.sign(payload);
  
    return {
      isRegistered: true,
      token,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
    };
  }
  

  // Reautenticação usando o refreshToken
  async reautenticar(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      return this.gerarTokens(payload.email);
    } catch (error) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }
}
