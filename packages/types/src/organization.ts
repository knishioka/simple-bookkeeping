/**
 * Organization type definitions
 */

export interface Organization {
  id: string;
  name: string;
  code: string;
  fiscalYearStart: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrganizationDto {
  name: string;
  code: string;
  fiscalYearStart: number;
}

export interface UpdateOrganizationDto {
  name?: string;
  fiscalYearStart?: number;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}
