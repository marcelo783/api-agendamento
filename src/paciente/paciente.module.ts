import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Paciente, PacienteSchema } from './paciente.schema';
import { PacienteService } from './paciente.service';
import { PacienteController } from './paciente.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Paciente.name, schema: PacienteSchema }])],
  controllers: [PacienteController],
  providers: [PacienteService],
  exports: [MongooseModule.forFeature([{ name: Paciente.name, schema: PacienteSchema }])]
})
export class PacienteModule {}