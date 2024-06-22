import { Test, TestingModule } from '@nestjs/testing';
import { AgendamentoController } from './agendamento.controller';

describe('AgendamentoController', () => {
  let controller: AgendamentoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgendamentoController],
    }).compile();

    controller = module.get<AgendamentoController>(AgendamentoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});