import { Controller, Get, Post, Param, Patch, UseGuards, Req, Query, Put, Delete, UnauthorizedException, Headers, Body, BadRequestException } from '@nestjs/common';
import { AgendamentoService } from './agendamento.service';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { Agendamento } from './agendamento.schema';
import path from 'path';
import { AuthGuard } from '@nestjs/passport';


@Controller('agendamentos')
export class AgendamentoController {
  constructor(private readonly agendamentoService: AgendamentoService) {}

  @Get('contador-geral')
  async obterContadorGeral(): Promise<{
    concluido: number;
    cancelado: number;
    ausente: number;
    expirado: number;
  }> {
    return this.agendamentoService.calcularContadorGeral();
  }

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
  async deletarAgendamentoPorId(
    @Param('id') id: string,
    @Headers('authorization') authorization: string, // Recebe o token do header
  ): Promise<{ message: string }> {
    const accessToken = authorization?.split(' ')[1]; // Extrai o token do header
    if (!accessToken) {
      throw new Error('Access token não fornecido');
    }
  
    return this.agendamentoService.deletarAgendamentoPorId(id, accessToken);
  }
  



// @Delete(':googleCalendarId')
//   //@UseGuards(AuthGuard('jwt')) // Protegendo a rota com JWT AuthGuard
//   async deletarAgendamento(
//     @Param('googleCalendarId') googleCalendarId: string,
//     @Headers('authorization') authorization: string,
//   ) {
//     // Extrair o token do header
//     const accessToken = authorization?.split(' ')[1];
//     if (!accessToken) {
//       throw new Error('Token de autenticação não encontrado');
//     }

//     // Chamando o serviço para deletar o agendamento
//     return this.agendamentoService.deletarAgendamento(googleCalendarId, accessToken);
//   }
  

  

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
  async confirmarAgendamento(
    @Body() createAgendamentoDto: CreateAgendamentoDto,
    @Req() req: any,
  ): Promise<any> {
    try {
      const accessToken = req.headers.authorization?.split(' ')[1];
      if (!accessToken) {
        throw new Error('Access token não fornecido');
      }
  
      return await this.agendamentoService.confirmarAgendamento(createAgendamentoDto, accessToken);
    } catch (error) {
      console.error('Erro ao confirmar agendamento:', error);
      throw new BadRequestException(error.message);
    }
  }
  

  @Patch(':agendamentoId/horarios/:horarioId/status')
async updateStatus(
  @Param('agendamentoId') agendamentoId: string,
  @Param('horarioId') horarioId: string,
  @Body('status') novoStatus: string,
  @Headers('Authorization') accessToken: string,
): Promise<any> {
  return this.agendamentoService.updateStatusAgendamentos(
    agendamentoId,
    horarioId,
    novoStatus,
    accessToken,
  );
}



  //atualizar agendamento no calendar e no banco

  @Put('calendar/event/:Id')
  async updateEvent(
    @Param('id') id: string, // Altere para `id`
    @Body() updateData: CreateAgendamentoDto,
    @Req() req: any
  ) {
    const accessToken = req.headers.authorization.split(' ')[1];
    return this.agendamentoService.atualizarAgendamento(id, updateData, accessToken); // Passe `id`
  }
  

//   @Patch(':id')
// async atualizarAgendamentoPorId(
//   @Param('id') id: string,
//   @Body() updateAgendamentoDto: CreateAgendamentoDto,
//   @Req() req: any,
// ) {
//   const accessToken = req.cookies?.authToken || req.headers.authorization?.split(' ')[1];
//   if (!accessToken) {
//     throw new Error('Token de autenticação não encontrado');
//   }

//   return this.agendamentoService.atualizarAgendamento(id, updateAgendamentoDto);
// }

  
  

@Get('googleCalendar/:googleCalendarId')
async findByGoogleCalendarId(
  @Param('googleCalendarId') googleCalendarId: string,
): Promise<Agendamento> {
  return this.agendamentoService.findByGoogleCalendarId(googleCalendarId);
}
}