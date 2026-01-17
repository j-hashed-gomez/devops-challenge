import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { VisitsService } from './visits/visits.service';

describe('AppController', () => {
  let appController: AppController;
  let visitsService: VisitsService;

  beforeEach(async () => {
    const mockVisitsService = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: VisitsService,
          useValue: mockVisitsService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    visitsService = app.get<VisitsService>(VisitsService);
  });

  describe('visitorInfo', () => {
    it('should return visitor information', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const mockRequest = {
        method: 'GET',
        path: '/',
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
        get: jest.fn().mockReturnValue('test-agent'),
        query: {},
      } as any;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await appController.visitorInfo(mockRequest);

      expect(result).toEqual({
        request: '[GET] /',
        user_agent: 'test-agent',
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(visitsService.create).toHaveBeenCalled();
    });
  });

  describe('getVersion', () => {
    it('should return version information', () => {
      const result = appController.getVersion();
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('environment');
    });
  });
});
