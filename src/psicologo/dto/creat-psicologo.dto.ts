// src/psicologo/dto/create-psicologo.dto.ts
import { IsString, IsEmail, IsNotEmpty } from 'class-validator';

export class CreatePsicologoDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  senha: string;

  @IsString()
  telefone: string;

  @IsString()
  especialidade: string;

  @IsString()
  registroProfissional: string;

  @IsString()
  @IsNotEmpty()
  userName: string;
}