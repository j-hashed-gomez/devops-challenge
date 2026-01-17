import { Module } from '@nestjs/common';
import { VisitsService } from './visits.service';
import { Visit, VisitSchema } from './entities/visit.entity';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Visit.name, schema: VisitSchema }]),
  ],
  controllers: [],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
