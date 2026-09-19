import { UserDocument } from '../users/entities/user.entity';

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserDocument;
  }
}
