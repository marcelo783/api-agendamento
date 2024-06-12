import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
 googleLogin(req){
  if(!req.use){
    return 'Nenhum usuário do Google'
  }
  return {
    message: 'Informações do usuário do Google',
    user: req.user
  }
 }
}
