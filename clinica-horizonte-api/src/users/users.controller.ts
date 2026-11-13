import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OidcAuthGuard } from '../auth/oidc-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(OidcAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('doctors')
  @Roles('ADMIN_STAFF', 'HEALTH_PROFESSIONAL')
  listDoctors() {
    return this.users.listDoctors();
  }

  @Post()
  @Roles('IT_ADMIN')
  create(@Body() input: CreateUserDto) {
    return this.users.create(input);
  }
}