import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VisitDocument = Visit & Document;

@Schema()
export class Visit {
  @Prop({ required: true, type: Date })
  visit_dt: Date;

  @Prop({ required: true })
  ip: string;

  @Prop({ required: true })
  user_agent: string;
}

export const VisitSchema = SchemaFactory.createForClass(Visit);
