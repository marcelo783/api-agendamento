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
    try {
      const isRegistered = await this.authService.isUserRegistered(user.email);

      if (!isRegistered) {
        // Redireciona para o registro se o usuário não estiver registrado
        return res.redirect('http://localhost:5173/register');
      }

      const token = await this.authService.login(user);

      // Define o cookie com o token JWT
      res.cookie('authToken', token.token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 3600000, // 1 hora
      });

      // Redireciona para a página de administração
      return res.redirect('http://localhost:5173/adm');
    } catch (error) {
      console.error('Erro ao redirecionar após o login com Google:', error);
      return res.redirect('http://localhost:5173/error');
    }
  }
}
