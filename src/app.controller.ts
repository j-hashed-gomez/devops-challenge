import { Controller, Get, Req } from '@nestjs/common';
import { VisitsService } from './visits/visits.service';
import { CreateVisitDto } from './visits/dto/create-visit.dto';
import { Request } from 'express';
import { VisitorInfoResponseDto } from './dto/visitorInfoResponse.dto';

@Controller()
export class AppController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get()
  async visitorInfo(@Req() request: Request): Promise<VisitorInfoResponseDto> {
    const createVisitDto: CreateVisitDto = {
      visit_dt: new Date(),
      ip: request.ip || request.socket.remoteAddress || '-',
      user_agent: request.get('user-agent') || 'unknown',
    };

    await this.visitsService.create(createVisitDto);
    const queryParams =
      Object.keys(request.query).length > 0
        ? `?${new URLSearchParams(request.query as Record<string, string>).toString()}`
        : '';
    return {
      request: `[${request.method}] ${request.path}${queryParams}`,
      user_agent: request.get('user-agent') ?? 'unknown',
    };
  }
}
