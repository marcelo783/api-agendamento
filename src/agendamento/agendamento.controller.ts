import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AgendamentoService } from './agendamento.service';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { Agendamento } from './agendamento.schema';

@Controller('agendamentos')
export class AgendamentoController {
  constructor(private readonly agendamentoService: AgendamentoService) {}

  @Post()
  async create(@Body() createAgendamentoDto: Agendamento): Promise<Agendamento> {
    return this.agendamentoService.create(createAgendamentoDto);
  }

  @Get()
  async findAll(): Promise<Agendamento[]> {
    return this.agendamentoService.findAll();
  }

  @Get('psicologo/:id')
  async findByPsicologo(@Param('id') psicologoId: string): Promise<Agendamento[]> {
    return this.agendamentoService.findByPsicologo(psicologoId);
  }

  @Get('disponibilidade/:psicologoId')
  async getDisponibilidade(@Param('psicologoId') psicologoId: string): Promise<any[]> {
    return this.agendamentoService.getDisponibilidade(psicologoId);
  }

  @Post('agendar')
  async createAgendamento(@Body() createAgendamentoDto: CreateAgendamentoDto): Promise<Agendamento> {
    return this.agendamentoService.createAgendamento(createAgendamentoDto);
  }
}
