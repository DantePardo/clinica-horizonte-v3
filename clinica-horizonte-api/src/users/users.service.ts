import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateUserDto) {
    return this.prisma.user.create({
      data: input,
      select: { id: true, identityId: true, role: true, displayName: true },
    });
  }

  listDoctors() {
    return this.prisma.user.findMany({
      where: { role: Role.HEALTH_PROFESSIONAL },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });
  }
}