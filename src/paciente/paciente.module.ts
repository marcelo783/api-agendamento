import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Paciente, PacienteSchema } from './paciente.schema';
import { PacienteService } from './paciente.service';
import { PacienteController } from './paciente.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Paciente.name, schema: PacienteSchema }]), // Importa o schema do paciente
  ],
  controllers: [PacienteController], // Controlador que lida com as requisições
  providers: [PacienteService],      // Provedor do serviço de Paciente
  exports: [MongooseModule.forFeature([{ name: Paciente.name, schema: PacienteSchema }])] // Aqui exportamos o PacienteModel
})
export class PacienteModule {}
