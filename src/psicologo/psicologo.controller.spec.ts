import { Test, TestingModule } from '@nestjs/testing';
import { PsicologoController } from './psicologo.controller';

describe('PsicologoController', () => {
  let controller: PsicologoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PsicologoController],
    }).compile();

    controller = module.get<PsicologoController>(PsicologoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});