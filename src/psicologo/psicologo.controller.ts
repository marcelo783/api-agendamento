import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { PsicologoService } from './psicologo.service';
import { CreatePsicologoDto } from './dto/creat-psicologo.dto';

@Controller('psicologos')
export class PsicologoController {
  constructor(private readonly psicologoService: PsicologoService) {}

  @Post()
  create(@Body() createPsicologoDto: CreatePsicologoDto) {
    return this.psicologoService.create(createPsicologoDto);
  }

  @Get()
  findAll() {
    return this.psicologoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.psicologoService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updatePsicologoDto: CreatePsicologoDto) {
    return this.psicologoService.update(id, updatePsicologoDto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.psicologoService.delete(id);
  }
}