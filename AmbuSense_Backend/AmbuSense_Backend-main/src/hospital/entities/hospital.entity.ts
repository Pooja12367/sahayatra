import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HospitalDocument = HydratedDocument<Hospital>;

@Schema({ timestamps: true })
export class Hospital {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  phone!: string;

  @Prop({ required: true, trim: true })
  address!: string;

  @Prop({
    required: true,
    enum: ['available', 'busy', 'offline'],
    default: 'available',
  })
  status!: 'available' | 'busy' | 'offline';

  @Prop({ required: true, min: 0 })
  capacity!: number;

  @Prop({ required: true, min: 0 })
  availableBeds!: number;

  @Prop({ type: [String], default: [] })
  specialization!: string[];

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
      default: [85.324, 27.7172],
    },
  })
  location!: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export const HospitalSchema = SchemaFactory.createForClass(Hospital);
HospitalSchema.index({ location: '2dsphere' });
