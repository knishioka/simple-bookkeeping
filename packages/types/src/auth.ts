/**
 * Authentication type definitions
 */

import { UserRole } from './enums';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  name: string;
  organizationName?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string;
}
