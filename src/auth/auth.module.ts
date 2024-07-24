// auth.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { GoogleCalendarModule } from 'src/google-calendar/google-calendar.module';


@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: 'JWT_SECRET', // Defina sua chave secreta aqui
      signOptions: { expiresIn: '1h' },
      
    }),
    forwardRef(() => GoogleCalendarModule)
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, JwtStrategy],
  exports: [AuthService, JwtStrategy] // Export AuthService and JwtStrategy for use in other modules
})
export class AuthModule {}
