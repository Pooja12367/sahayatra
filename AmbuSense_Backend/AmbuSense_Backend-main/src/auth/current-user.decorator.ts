import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserDocument } from '../users/entities/user.entity';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserDocument | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: UserDocument }>();
    return request.user;
  },
);
