import { Injectable } from '@nestjs/common';
import { Response } from 'express';

@Injectable()
export class AppService {
  googleLogin(req, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Nenhum usuário do Google' });
    }
  
    console.log(' req.user:', req.user);
  
    // Extraindo os tokens corretamente
    const { token, accessToken, refreshToken } = req.user.jwt || {};
  
    console.log(' Tokens recebidos:', { token, accessToken, refreshToken });
  
    if (!refreshToken) {
      console.error(' Erro: refreshToken ausente no req.user');
    }
  
    // Configurar cookies apenas se os tokens existirem
    if (token) {
      res.cookie('authToken', token, {
        httpOnly: false,
        secure: false, // Use 'true' em produção com HTTPS
        sameSite: 'lax',
        maxAge: 3600000, // 1 hora
      });
    }
  
    if (accessToken) {
      res.cookie('accessToken', accessToken, {
        httpOnly: false,
        secure: false,
        sameSite: 'lax',
        maxAge: 3600000,
      });
    }
  
    if (refreshToken) {
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
      });
    } else {
      console.error('Não foi possível definir o refreshToken no cookie');
    }
  
    // Log dos cookies definidos
    console.log('🔍 Headers de resposta (após cookies):', res.getHeaders()['set-cookie']);
  
    // Redirecionar para o frontend
    return res.redirect('http://localhost:5173/register');
  }
}
