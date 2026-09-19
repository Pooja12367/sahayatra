import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AmbulanceStatus } from '../../constants/enums';

export type AmbulanceDocument = HydratedDocument<Ambulance>;

export interface IAmbulance {
  ambulanceCode: string;
  driverName: string;
  phone: string;
  status: AmbulanceStatus;
  currentLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
  isActive: boolean;
  assignedAt?: Date | null;
  reachedPatientAt?: Date | null;
  transportStartedAt?: Date | null;
  reachedHospitalAt?: Date | null;
  completedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

@Schema({ timestamps: true })
export class Ambulance {
  @Prop({ required: true, unique: true, trim: true })
  ambulanceCode!: string;

  @Prop({ required: true, trim: true })
  driverName!: string;

  @Prop({ required: true, trim: true })
  phone!: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(AmbulanceStatus),
    default: AmbulanceStatus.OFFLINE,
  })
  status!: AmbulanceStatus;

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
  currentLocation!: {
    type: 'Point';
    coordinates: [number, number];
  };

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: Date, default: null })
  assignedAt!: Date | null;

  @Prop({ type: Date, default: null })
  reachedPatientAt!: Date | null;

  @Prop({ type: Date, default: null })
  transportStartedAt!: Date | null;

  @Prop({ type: Date, default: null })
  reachedHospitalAt!: Date | null;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AmbulanceSchema = SchemaFactory.createForClass(Ambulance);
AmbulanceSchema.index({ currentLocation: '2dsphere' });
