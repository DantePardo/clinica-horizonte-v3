import { Request } from 'express';

export interface AuthenticatedUser {
  sub: string;
  username?: string;
  roles: string[];
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}