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
import { cn } from '@/lib/utils';

interface Partner {
  id: string;
  code: string;
  name: string;
  partnerType: 'CUSTOMER' | 'VENDOR' | 'BOTH';
}

interface PartnerSelectProps {
  partners: Partner[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const partnerTypeLabels = {
  CUSTOMER: '顧客',
  VENDOR: '仕入先',
  BOTH: '両方',
};

export function PartnerSelect({
  partners,
  value,
  onValueChange,
  placeholder = '取引先を選択...',
  disabled = false,
}: PartnerSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedPartner = partners.find((partner) => partner.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedPartner ? (
            <span className="truncate">
              {selectedPartner.code} - {selectedPartner.name}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="検索..." />
          <CommandEmpty>取引先が見つかりません</CommandEmpty>
          <CommandGroup className="max-h-[300px] overflow-auto">
            <CommandItem
              value=""
              onSelect={() => {
                onValueChange('');
                setOpen(false);
              }}
            >
              <span className="text-muted-foreground">なし</span>
            </CommandItem>
            {partners.map((partner) => (
              <CommandItem
                key={partner.id}
                value={`${partner.code} ${partner.name}`}
                onSelect={() => {
                  onValueChange(partner.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn('mr-2 h-4 w-4', value === partner.id ? 'opacity-100' : 'opacity-0')}
                />
                <div className="flex flex-col">
                  <div>
                    {partner.code} - {partner.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {partnerTypeLabels[partner.partnerType]}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
