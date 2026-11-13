import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OidcAuthGuard } from '../auth/oidc-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(OidcAuthGuard, RolesGuard)
@Roles('SECURITY_AUDITOR')
@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    const parsedLimit = Number.parseInt(limit ?? '100', 10);
    const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 100;
    return this.prisma.auditOutbox.findMany({
      orderBy: { occurredAt: 'desc' },
      take,
      select: {
        id: true,
        eventType: true,
        actorId: true,
        occurredAt: true,
        ipAddress: true,
        resource: true,
        resourceId: true,
        metadata: true,
      },
    });
  }
}