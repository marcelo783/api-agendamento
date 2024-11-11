import { IsNotEmpty, IsEmail, IsString, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

class HorarioDto {
  @IsNotEmpty()
  @IsString()
  inicio: string;

  @IsNotEmpty()
  @IsString()
  fim: string;

  @IsNotEmpty()
  @IsString()
  duracao: number;
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

  

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DisponibilidadeDto)
  disponibilidade: DisponibilidadeDto[];
}
