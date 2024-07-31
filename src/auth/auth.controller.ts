import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
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
  async googleAuthRedirect(@Query('code') code: string, @Req() req: Request, @Res() res: Response) {
    try {
      const tokens = await this.authService.getTokensFromCode(code);
      console.log('Tokens obtidos:', tokens);
      const token = await this.authService.login({ ...req.user, ...tokens });
      return res.redirect(`http://localhost:5000?token=${token.token}`);
    } catch (error) {
      console.error('Erro ao obter tokens do Google:', error);
      return res.redirect('http://localhost:5000/error');
    }
  }
}
