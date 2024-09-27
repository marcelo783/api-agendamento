import { Controller, Get, Post, Body, Param, Patch, UseGuards, Req, Query, Put } from '@nestjs/common';
import { AgendamentoService } from './agendamento.service';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { Agendamento } from './agendamento.schema';
import path from 'path';


@Controller('agendamentos')
export class AgendamentoController {
  constructor(private readonly agendamentoService: AgendamentoService) {}


  @Post()
  async create(
    @Body() createAgendamentoDto: Agendamento,
   
  ): Promise<Agendamento> {
    return this.agendamentoService.create(createAgendamentoDto);
  }

  //@Get()
  //async findAll(): Promise<Agendamento[]> {
    //return this.agendamentoService.findAll();
  //}

  // Endpoint para listar todos os agendamentos com filtros
  @Get()
  async findAll(
    @Query('titulo') titulo: string, // Filtro por título (opcional)
    @Query('data') data: string,     // Filtro por data (opcional)
  ): Promise<Agendamento[]> {
    return this.agendamentoService.findAllWithFilters(titulo, data);
  }

  

  @Get('psicologo/:id')
  async findByPsicologo(
    @Param('id') psicologoId: string,
  ): Promise<Agendamento[]> {
    return this.agendamentoService.findByPsicologo(psicologoId);
  }

  @Get('disponibilidade/:psicologoId')
  async getDisponibilidade(
    @Param('psicologoId') psicologoId: string,
  ): Promise<any[]> {
    return this.agendamentoService.getDisponibilidade(psicologoId);
  }

  @Patch('agendar')
  async createAgendamento(
    @Body() createAgendamentoDto: CreateAgendamentoDto,
  ): Promise<any> {
    return this.agendamentoService.confirmarAgendamento(createAgendamentoDto);
  }

  @Patch('atualizar/status/:status/agendamento/:agendamentoId')
  async updateStatus(
    @Param('status') status: string,
    @Param('agendamentoId') agendamentoId: string
  ): Promise<any> {
    return this.agendamentoService.updateStatusAgendamentos(status, agendamentoId);
  }


  //atualizar agendamento no calendar e no banco

  @Put('calendar/event/:googleCalendarId')
  async updateEvent(
    @Param('googleCalendarId') googleCalendarId: string,
    @Body() updateData: CreateAgendamentoDto,  // Atualiza o Google Calendar e o Banco de Dados
    @Req() req: any  // Para capturar o accessToken
  ) {
    const accessToken = req.headers.authorization.split(' ')[1];  // Captura o accessToken do header
    return this.agendamentoService.atualizarAgendamento(googleCalendarId, updateData, accessToken);
  }
  
  
  

@Get('googleCalendar/:googleCalendarId')
async findByGoogleCalendarId(
  @Param('googleCalendarId') googleCalendarId: string,
): Promise<Agendamento> {
  return this.agendamentoService.findByGoogleCalendarId(googleCalendarId);
}
}