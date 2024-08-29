import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    sub: string;  // ID do psicólogo
    email: string;
    nome: string;
    especialidade: string;
    registroProfissional: string;
  };
}
