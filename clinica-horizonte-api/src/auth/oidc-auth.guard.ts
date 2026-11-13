import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, JWTPayload, jwtVerify } from 'jose';
import { AuthenticatedRequest } from './auth.types';

@Injectable()
export class OidcAuthGuard implements CanActivate {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(config: ConfigService) {
    this.issuer = config.getOrThrow<string>('OIDC_ISSUER');
    this.audience = config.getOrThrow<string>('OIDC_AUDIENCE');
    this.jwks = createRemoteJWKSet(
      new URL(`${this.issuer}/protocol/openid-connect/certs`),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });
      if (!payload.sub) throw new UnauthorizedException();

      request.user = {
        sub: payload.sub,
        username: typeof payload.preferred_username === 'string'
          ? payload.preferred_username
          : undefined,
        roles: this.getRoles(payload),
      };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private getRoles(payload: JWTPayload): string[] {
    const realmAccess = payload.realm_access as { roles?: unknown } | undefined;
    return Array.isArray(realmAccess?.roles)
      ? realmAccess.roles.filter((role): role is string => typeof role === 'string')
      : [];
  }
}