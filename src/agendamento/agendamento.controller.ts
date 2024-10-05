import { Controller, Get, Post, Body, Param, Patch, UseGuards, Req, Query, Put, Delete, UnauthorizedException, Headers } from '@nestjs/common';
import { AgendamentoService } from './agendamento.service';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { Agendamento } from './agendamento.schema';
import path from 'path';
import { AuthGuard } from '@nestjs/passport';


@Controller('agendamentos')
export class AgendamentoController {
  constructor(private readonly agendamentoService: AgendamentoService) {}


  @Get(':id')
async findById(
  @Param('id') id: string,
): Promise<Agendamento> {
  return this.agendamentoService.findById(id);
}



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


  //deletar pelo _id do evento
  @Delete(':id')
//@UseGuards(AuthGuard('jwt')) // Protege a rota com autenticação JWT
async deletarAgendamentoPorId(
  @Param('id') id: string,
  @Req() req: any,
) {
  const token = req.cookies?.authToken || req.headers.authorization?.split(' ')[1];
  if (!token) {
    throw new Error('Token de autenticação não encontrado');
  }

  return this.agendamentoService.deletarAgendamentoPorId(id);
}



@Delete(':googleCalendarId')
  //@UseGuards(AuthGuard('jwt')) // Protegendo a rota com JWT AuthGuard
  async deletarAgendamento(
    @Param('googleCalendarId') googleCalendarId: string,
    @Headers('authorization') authorization: string,
  ) {
    // Extrair o token do header
    const accessToken = authorization?.split(' ')[1];
    if (!accessToken) {
      throw new Error('Token de autenticação não encontrado');
    }

    // Chamando o serviço para deletar o agendamento
    return this.agendamentoService.deletarAgendamento(googleCalendarId, accessToken);
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
  

  @Patch(':id')
async atualizarAgendamentoPorId(
  @Param('id') id: string,
  @Body() updateAgendamentoDto: CreateAgendamentoDto,
  @Req() req: any,
) {
  const accessToken = req.cookies?.authToken || req.headers.authorization?.split(' ')[1];
  if (!accessToken) {
    throw new Error('Token de autenticação não encontrado');
  }

  return this.agendamentoService.atualizarAgendamentoPorId(id, updateAgendamentoDto);
}

  
  

@Get('googleCalendar/:googleCalendarId')
async findByGoogleCalendarId(
  @Param('googleCalendarId') googleCalendarId: string,
): Promise<Agendamento> {
  return this.agendamentoService.findByGoogleCalendarId(googleCalendarId);
}
}