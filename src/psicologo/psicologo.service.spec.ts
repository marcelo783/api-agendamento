import { Test, TestingModule } from '@nestjs/testing';
import { PsicologoService } from './psicologo.service';

describe('PsicologoService', () => {
  let service: PsicologoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PsicologoService],
    }).compile();

    service = module.get<PsicologoService>(PsicologoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});