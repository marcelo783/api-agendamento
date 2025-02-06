import { Controller, Get, Post, Req, Res, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Lógica de autenticação com Google gerenciada pelo AuthGuard
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    console.log('🔍 req.user recebido do Google:', req.user);
    const user = req.user;

    // Faz o login e obtém os tokens
    const loginResult = await this.authService.login(user);

    console.log(' Refresh Token recebido no loginResult:', loginResult.refreshToken);

    if (!loginResult.refreshToken) {
      return res.status(500).json({ message: 'Erro ao obter refresh token.' });
    }

    // Salva os tokens no cookie
    res.cookie('authToken', loginResult.token, {
      httpOnly: true,
      secure: false, // Defina como `true` em produção
      sameSite: 'lax',
      maxAge: 3600000, // 1 hora
    });

    res.cookie('accessToken', loginResult.accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 30 * 60 * 1000, // 30 minutos
    });

    console.log(' Refresh Token recebido no loginResult:', loginResult.refreshToken);

if (!loginResult.refreshToken) {
  console.error('❌ Erro: RefreshToken ausente. O Google pode não ter enviado.');
} else {
  console.log('✅ Salvando refreshToken no cookie...');
  res.cookie('refreshToken', loginResult.refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
  });
}

    // Log dos cookies definidos
    console.log('🔍 Headers de resposta:', res.getHeaders()['set-cookie']);

    // Redireciona para a página de administração
    return res.redirect('http://localhost:5173/adm');
  }

  @Post('refresh')
  async refreshTokens(@Body() body, @Res() res: Response) {
    const { refreshToken } = body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token não fornecido.' });
    }

    // Verifica o refreshToken e gera novos tokens
    const newTokens = await this.authService.reautenticar(refreshToken);

    // Atualiza os cookies com os novos tokens
    res.cookie('accessToken', newTokens.accessToken, {
      httpOnly: true,
      secure: false, // Defina como `true` em produção
      sameSite: 'lax',
      maxAge: 30 * 60 * 1000, // 30 minutos
    });

    res.cookie('refreshToken', newTokens.refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    });

    return res.status(200).json({ message: 'Tokens renovados com sucesso!' });
  }
}
