import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export const SESSION_COOKIE = 'sms_session';

export interface SessionPayload {
  sub: string;
  tv: number;
}

const IS_PUBLIC = 'isPublic';
const ROLES = 'roles';

/** Route needs no login. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Route needs one of these roles (on top of being logged in). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export type AuthedRequest = Request & { user?: User };

/** The logged-in user, loaded by AuthGuard. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): User => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user!;
});

/**
 * Global guard: every route requires a valid session cookie unless marked @Public().
 * On public routes a valid session is still loaded so handlers can personalise.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const user = await this.loadUser(req);

    if (!user) {
      if (isPublic) return true;
      throw new UnauthorizedException('Please log in');
    }
    if (user.status === 'BANNED' || user.status === 'DELETED' || user.status === 'SUSPENDED') {
      if (isPublic) return true;
      throw new ForbiddenException(
        user.status === 'SUSPENDED' ? 'Your account is suspended. Please contact support.' : 'This account is not active.',
      );
    }
    req.user = user;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(user.role)) throw new ForbiddenException('Not allowed');

    // Keep "recently active" fresh without writing on every request.
    if (Date.now() - user.lastActiveAt.getTime() > 15 * 60 * 1000) {
      await this.prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
    }
    return true;
  }

  private async loadUser(req: Request): Promise<User | null> {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<SessionPayload>(token);
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.tokenVersion !== payload.tv) return null;
      return user;
    } catch {
      return null;
    }
  }
}
