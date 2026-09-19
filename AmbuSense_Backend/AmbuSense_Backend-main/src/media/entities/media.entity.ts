import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';

export type MediaDocument = HydratedDocument<Media>;

@Schema({ timestamps: true })
export class Media {
  @Prop({ required: true, trim: true })
  originalName!: string;

  @Prop({ required: true, trim: true })
  fileName!: string;

  @Prop({ required: true, trim: true })
  mimeType!: string;

  @Prop({ required: true })
  size!: number;

  @Prop({ required: true, trim: true })
  path!: string;

  @Prop({ required: true, trim: true })
  url!: string;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  uploadedBy!: Types.ObjectId;
}

export const MediaSchema = SchemaFactory.createForClass(Media);
