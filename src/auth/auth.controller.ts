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
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const user = req.user;
    console.log('User:', user); // Adicione este log para verificar os dados do usuário
    if (!user) {
      return res.redirect('http://localhost:5000/error'); // Redireciona para uma página de erro, se necessário
    }
    const token = await this.authService.login(user);
    console.log('Token:', token); // Adicione este log para verificar o token gerado
    return res.redirect(`http://localhost:5000?token=${token.token}`);
  }
}
