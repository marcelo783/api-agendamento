import { IsNotEmpty, IsEmail, IsString, IsDateString } from 'class-validator';



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
  @IsDateString()
  horario: Date;

  @IsNotEmpty()
  @IsString()
  formatoConsulta: string;

  @IsNotEmpty()
  @IsString()
  psicologoId: string;
}
