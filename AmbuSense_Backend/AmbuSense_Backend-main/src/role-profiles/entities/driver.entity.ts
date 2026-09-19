import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Media } from '../../media/entities/media.entity';
import { User } from '../../users/entities/user.entity';

export type DriverDocument = HydratedDocument<Driver>;

@Schema({ timestamps: true })
export class Driver {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true })
  user!: Types.ObjectId;

  @Prop({ type: String, trim: true, default: null })
  documentType!: string | null;

  @Prop({ type: Types.ObjectId, ref: Media.name, default: null })
  documentImageId!: Types.ObjectId | null;

  @Prop({ default: false })
  isVerified!: boolean;

  @Prop({ type: String, trim: true, default: null })
  verificationNote!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const DriverSchema = SchemaFactory.createForClass(Driver);
