// src/paciente/dto/create-paciente.dto.ts
import { IsString, IsEmail, IsNotEmpty } from 'class-validator';

export class CreatePacienteDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  telefone: string;
}
