'use client';

import { useEffect, useState } from 'react';

export function useOrganization() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedOrgId = localStorage.getItem('selectedOrganizationId');
    setOrganizationId(storedOrgId);
    setIsLoading(false);
  }, []);

  return { organizationId, isLoading };
}
