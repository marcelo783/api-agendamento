import { IsNotEmpty, IsEmail, IsString, IsArray, ValidateNested, IsDateString, IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';
import { IsIn } from 'class-validator';

class HorarioDto {

 
  @IsOptional() // Apenas horários existentes terão `_id`
  @IsString()   // MongoDB `_id` será sempre uma string ao ser recebido
  _id?: string;


  @IsNotEmpty()
  @IsString()
  inicio: string;

  @IsNotEmpty()
  @IsString()
  fim: string;

  @IsNotEmpty()
  duracao: number;

  @IsNotEmpty()
  @IsString()
  @IsIn(['disponivel', 'cancelado', 'concluido', 'ausente', 'expirado', 'agendado']) // Restrições do campo status
  status: string;

  @IsOptional()
  paciente: Types.ObjectId | null;

  @IsOptional() // O Google Calendar ID é opcional inicialmente
  @IsString()
  googleCalendarId?: string;
}

class DisponibilidadeDto {
  @IsNotEmpty()
  @IsDateString()
  dia: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HorarioDto)
  horarios: HorarioDto[];
}

export class CreateAgendamentoDto {

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  statusContador?: {
    concluido: number;
    cancelado: number;
    ausente: number;
    expirado: number;
  };

  
  @IsNotEmpty()
  @IsString()
  pacienteNome: string;

  @IsOptional()
  @IsEmail()
  pacienteEmail: string;

  @IsNotEmpty()
  @IsString()
  pacienteTelefone: string;

  @IsNotEmpty()
  @IsString()
  agendamentoId: string;

  @IsNotEmpty()
  @IsString()
  titulo: string;

  @IsNotEmpty()
  @IsString()
  descricao: string;

  

  @IsNotEmpty()
  @IsString()
  formatoConsulta: string;

  // Use apenas a estrutura de disponibilidade para datas e horários
  @IsNotEmpty()
  @IsString()
  horarioId: string; 

   // Adicionando a propriedade disponibilidade
   @IsArray()
   @ValidateNested({ each: true })
   @Type(() => DisponibilidadeDto)
   disponibilidade: DisponibilidadeDto[];
}
