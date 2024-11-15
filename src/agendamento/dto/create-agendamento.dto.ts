import { IsNotEmpty, IsEmail, IsString, IsArray, ValidateNested, IsDateString, IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';

class HorarioDto {
  @IsNotEmpty()
  @IsString()
  inicio: string;

  @IsNotEmpty()
  @IsString()
  fim: string;

  @IsNotEmpty()
  duracao: number;

  // Novas Propriedades
  @IsBoolean()
  @IsOptional()
  reservado: boolean;

  @IsOptional()
  paciente: Types.ObjectId | null;
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
  @IsNotEmpty()
  @IsString()
  pacienteNome: string;

  @IsNotEmpty()
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
  status: string;

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
