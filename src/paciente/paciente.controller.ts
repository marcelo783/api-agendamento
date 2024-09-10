import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { PacienteService } from './paciente.service';
import { CreatePacienteDto } from './dto/creat-paciente.dto';
import { Paciente } from './paciente.schema';

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

  // Endpoint para buscar um paciente pelo ID
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Paciente> {
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