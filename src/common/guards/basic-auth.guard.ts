import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class BasicAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Basic ')) {
        throw new UnauthorizedException();
    }

    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const index = decoded.indexOf(':');
    const username = index < 0 ? '' : decoded.slice(0, index);
    const password = index < 0 ? '' : decoded.slice(index + 1);

    if (username !== this.config.get<string>('auth.username') || password !== this.config.get<string>('auth.password')) {
        throw new UnauthorizedException();
    }
    return true;
  }
}
