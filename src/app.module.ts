import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PsicologoModule } from './psicologo/psicologo.module';
import { PacienteModule } from './paciente/paciente.module';
import { AgendamentoModule } from './agendamento/agendamento.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GoogleCalendarModule } from './google-calendar/google-calendar.module';




@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Torna as variáveis disponíveis globalmente
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),
    GoogleCalendarModule,
    PsicologoModule,
    PacienteModule,
    AgendamentoModule,
  
    AuthModule, 
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
