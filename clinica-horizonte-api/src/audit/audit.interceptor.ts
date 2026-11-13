import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { mergeMap, Observable } from 'rxjs';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type AuditedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    if (!request.user) return next.handle();

    return next.handle().pipe(
      mergeMap(async (result) => {
        await this.prisma.auditOutbox.create({
          data: {
            eventType: `HTTP_${request.method}`,
            actorId: request.user?.sub,
            ipAddress: request.ip,
            resource: request.route?.path ?? request.path,
            resourceId: typeof request.params.id === 'string'
              ? request.params.id
              : typeof request.params.patientId === 'string'
                ? request.params.patientId
                : undefined,
            metadata: { statusCode: response.statusCode },
          },
        });
        return result;
      }),
    );
  }
}