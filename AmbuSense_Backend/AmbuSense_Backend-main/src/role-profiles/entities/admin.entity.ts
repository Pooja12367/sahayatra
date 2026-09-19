import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';

export type AdminDocument = HydratedDocument<Admin>;

@Schema({ timestamps: true })
export class Admin {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true })
  user!: Types.ObjectId;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);
