import { Controller, Get, Post, Req, Res, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as querystring from 'querystring'; 

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService, // Injete o ConfigService
  ) {}

  @Get('google')
  async googleAuth(@Res() res: Response) {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${querystring.stringify({
      client_id: this.configService.get<string>('GOOGLE_ID'),
      redirect_uri: this.configService.get<string>('GOOGLE_CALLBACK_URL'),
      response_type: 'code',
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/calendar'].join(' '),
      access_type: 'offline',
      prompt: 'consent',
    })}`;
  
    console.log('URL de autenticação gerada manualmente:', authUrl);
    return res.redirect(authUrl);
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))

  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    console.log('🔍 req.user recebido do Google:', req.user);
    const user = req.user;
  
    // Se o refreshToken ou accessToken estiver ausente, exibir um erro
    if (!user.accessToken || !user.refreshToken) {
      console.error("❌ Erro: AccessToken ou RefreshToken ausentes!");
      return res.status(500).json({ message: "Erro ao obter tokens de autenticação." });
    }
  
    // 🔥 Salvar tokens nos cookies
    res.cookie('authToken', user.jwt.token, {
      httpOnly: true,
      secure: false, // Alterar para `true` em produção
      sameSite: 'lax',
      maxAge: 3600000, // 1 hora
    });
  
    res.cookie('accessToken', user.accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 30 * 60 * 1000, // 30 minutos
    });
  
    res.cookie('refreshToken', user.refreshToken, {
      httpOnly: true,  // O refreshToken não deve ser acessível no frontend
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    });
  
    console.log("✅ RefreshToken salvo no cookie:", user.refreshToken);
  
    // Redirecionar para a página de administração
    return res.redirect('http://localhost:5173/adm');
  }

  @Post('refresh')
async refreshAccessToken(@Body() body: { refreshToken: string }, @Res() res: Response) {
  const { refreshToken } = body; // Pega o refreshToken do corpo da requisição

  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token ausente.' });
  }

  try {
    const newAccessToken = await this.authService.renewAccessToken(refreshToken);
    res.cookie('accessToken', newAccessToken.accessToken, {
      httpOnly: true,
      secure: false, // Use 'true' em produção com HTTPS
      sameSite: 'lax',
      maxAge: 30 * 60 * 1000, // 30 minutos
    });

    return res.status(200).json({ accessToken: newAccessToken.accessToken });
  } catch (error) {
    console.error('❌ Erro ao renovar access token:', error);
    return res.status(401).json({ message: 'Erro ao renovar access token.' });
  }
}
}