import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))

  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    const user = req.user;
  
    const loginResult = await this.authService.login(user);
  
    // Definindo o token JWT e o accessToken no cookie
    res.cookie('authToken', loginResult.token, {
      httpOnly: true,
      secure: false, // Defina como true em produção
      sameSite: 'lax',
      maxAge: 3600000, // 1 hora
    });
  
    res.cookie('accessToken', loginResult.accessToken, {
      httpOnly: true,
      secure: false, // Defina como true em produção
      sameSite: 'lax',
      maxAge: 3600000, // 1 hora
    });
  
    if (!loginResult.isRegistered) {
      // Se o psicólogo não estiver registrado, redireciona para a página de registro
      return res.redirect('http://localhost:5173/register');
    }
  
    // Se o psicólogo estiver registrado, redireciona para a página de administração
    return res.redirect('http://localhost:5173/adm');
  }
}