import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { PacienteService } from './paciente.service';
import { CreatePacienteDto } from './dto/creat-paciente.dto';

@Controller('pacientes')
export class PacienteController {
  constructor(private readonly pacienteService: PacienteService) {}

  @Post()
  create(@Body() createPacienteDto: CreatePacienteDto) {
    return this.pacienteService.create(createPacienteDto);
  }

  @Get()
  findAll() {
    return this.pacienteService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pacienteService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updatePacienteDto: CreatePacienteDto) {
    return this.pacienteService.update(id, updatePacienteDto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.pacienteService.delete(id);
  }
}