import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/entities/user.entity';

export type DispatcherDocument = HydratedDocument<Dispatcher>;

@Schema({ timestamps: true })
export class Dispatcher {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true })
  user!: Types.ObjectId;
}

export const DispatcherSchema = SchemaFactory.createForClass(Dispatcher);
