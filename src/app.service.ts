import { Injectable } from '@nestjs/common';
import { Response } from 'express';

@Injectable()
export class AppService {
  googleLogin(req, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Nenhum usuário do Google' });
    }
    console.log(req.user);
    

    // Configurar o cookie
    res.cookie('authToken', req.user.jwt.token, {
      httpOnly: false,
      secure: false,  // Use 'true' em produção com HTTPS
      sameSite: 'lax',
      maxAge: 3600000, // 1 hora
    });

    
    
    res.cookie('accessToken', req.user.accessToken, { 
      httpOnly: false,  
      secure: false,
      sameSite: 'lax',
      maxAge: 3600000, 
    });
  

    // Redirecionar para o frontend
    return res.redirect('http://localhost:5173/register');
  }
}