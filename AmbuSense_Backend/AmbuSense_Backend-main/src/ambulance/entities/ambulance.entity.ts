import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AmbulanceStatus } from '../../constants/enums';
import { User } from '../../users/entities/user.entity';

export type AmbulanceDocument = HydratedDocument<Ambulance>;

export interface IAmbulance {
  driverId?: string | null;
  ambulanceCode: string;
  driverName: string;
  phone: string;
  status: AmbulanceStatus;
  locationName?: string;
  currentLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
  locationUpdatedAt?: Date | null;
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
  @Prop({ type: Types.ObjectId, ref: User.name, default: null })
  driverId!: Types.ObjectId | null;

  @Prop({ required: true, unique: true, trim: true })
  ambulanceCode!: string;

  @Prop({ type: String, trim: true, default: '' })
  driverName!: string;

  @Prop({ type: String, trim: true, maxlength: 10, default: '' })
  phone!: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(AmbulanceStatus),
    default: AmbulanceStatus.OFFLINE,
  })
  status!: AmbulanceStatus;

  @Prop({ type: String, trim: true, maxlength: 300 })
  locationName?: string;

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
    },
  })
  currentLocation!: {
    type: 'Point';
    coordinates: [number, number];
  };

  @Prop({ type: Date, default: null })
  locationUpdatedAt!: Date | null;

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
AmbulanceSchema.index(
  { driverId: 1 },
  {
    unique: true,
    partialFilterExpression: { driverId: { $type: 'objectId' } },
  },
);
