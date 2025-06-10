'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

export function OrganizationSwitcher() {
  const { user, currentOrganization, switchOrganization } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user || !user.organizations || user.organizations.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          {currentOrganization ? currentOrganization.name : '組織を選択'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="組織を検索..." />
          <CommandEmpty>組織が見つかりません</CommandEmpty>
          <CommandGroup>
            {user.organizations.map((org) => (
              <CommandItem
                key={org.id}
                value={org.id}
                onSelect={() => {
                  switchOrganization(org.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    currentOrganization?.id === org.id ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {org.name}
                {org.isDefault && (
                  <span className="ml-2 text-xs text-muted-foreground">(デフォルト)</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}