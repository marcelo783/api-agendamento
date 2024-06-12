import { Test, TestingModule } from '@nestjs/testing';
import { AgendamentoService } from './agendamento.service';

describe('AgendamentoService', () => {
  let service: AgendamentoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AgendamentoService],
    }).compile();

    service = module.get<AgendamentoService>(AgendamentoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
