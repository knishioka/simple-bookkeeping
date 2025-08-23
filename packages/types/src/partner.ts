import { PartnerType } from './enums';

export interface Partner {
  id: string;
  code: string;
  name: string;
  nameKana?: string | null;
  partnerType: PartnerType;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  organizationId: string;
}

export interface CreatePartnerDto {
  code: string;
  name: string;
  nameKana?: string;
  partnerType: PartnerType;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
}

export interface UpdatePartnerDto extends Partial<CreatePartnerDto> {
  isActive?: boolean;
}

export interface PartnerBalance {
  partnerId: string;
  partnerName: string;
  receivableBalance: number;
  payableBalance: number;
  netBalance: number;
  asOfDate: string;
}
