import { Module } from '@nestjs/common';
import { OidcAuthGuard } from './oidc-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({ providers: [OidcAuthGuard, RolesGuard], exports: [OidcAuthGuard, RolesGuard] })
export class AuthModule {}