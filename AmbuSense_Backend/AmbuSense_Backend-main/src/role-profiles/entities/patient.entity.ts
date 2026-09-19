import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';

export type PatientDocument = HydratedDocument<Patient>;

@Schema({ timestamps: true })
export class Patient {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true })
  user!: Types.ObjectId;
}

export const PatientSchema = SchemaFactory.createForClass(Patient);
