import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PsicologoModule } from './psicologo/psicologo.module';
import { PacienteModule } from './paciente/paciente.module';
import { AgendamentoModule } from './agendamento/agendamento.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
    PsicologoModule,
    PacienteModule,
    AgendamentoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
