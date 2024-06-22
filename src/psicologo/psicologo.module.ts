import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PsicologoService } from './psicologo.service';
import { PsicologoController } from './psicologo.controller';
import { Psicologo, PsicologoSchema } from './psicologo.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Psicologo.name, schema: PsicologoSchema }]),
  ],
  controllers: [PsicologoController],
  providers: [PsicologoService],
})
export class PsicologoModule {}