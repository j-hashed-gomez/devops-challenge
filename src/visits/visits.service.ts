import { Injectable } from '@nestjs/common';
import { CreateVisitDto } from './dto/create-visit.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Visit, VisitDocument } from './entities/visit.entity';
import { Model } from 'mongoose';

@Injectable()
export class VisitsService {
  constructor(
    @InjectModel(Visit.name) private readonly visitModel: Model<VisitDocument>,
  ) {}

  async create(createVisit: CreateVisitDto) {
    return await this.visitModel.create(createVisit);
  }
}
