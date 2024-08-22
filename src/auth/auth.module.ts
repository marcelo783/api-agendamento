// auth.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { GoogleCalendarModule } from 'src/google-calendar/google-calendar.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Psicologo, PsicologoSchema } from 'src/psicologo/psicologo.schema';


@Module({
  imports: [
    MongooseModule.forFeature([{ name: Psicologo.name, schema: PsicologoSchema }]), // Registra o esquema do Psicologo
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
