export interface Partner {
  id: string;
  code: string;
  name: string;
  nameKana?: string | null;
  partnerType: 'CUSTOMER' | 'VENDOR' | 'BOTH';
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  organizationId: string;
}
