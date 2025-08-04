'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';
import * as wanakana from 'wanakana';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Account {
  id: string;
  code: string;
  name: string;
  nameKana?: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
}

interface AccountSearchComboboxProps {
  accounts: Account[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Convert hiragana to katakana
function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, function (match) {
    const chr = match.charCodeAt(0) + 0x60;
    return String.fromCharCode(chr);
  });
}

// Convert katakana to hiragana
function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30a1-\u30f6]/g, function (match) {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

// Normalize search text for flexible matching
function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '') // Remove spaces (both half-width and full-width)
    .replace(/[ー－]/g, ''); // Remove long vowel marks
}

export function AccountSearchCombobox({
  accounts,
  value,
  onValueChange,
  placeholder = '勘定科目を選択',
  disabled = false,
}: AccountSearchComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  const selectedAccount = React.useMemo(
    () => accounts.find((account) => account.id === value),
    [accounts, value]
  );

  const filteredAccounts = React.useMemo(() => {
    if (!searchValue) return accounts;

    const normalizedSearch = normalizeSearchText(searchValue);
    const hiraganaSearch = katakanaToHiragana(normalizedSearch);
    const katakanaSearch = hiraganaToKatakana(normalizedSearch);

    // Convert romaji to hiragana and katakana for search
    const romajiToHiragana = wanakana.toHiragana(searchValue);
    const romajiToKatakana = wanakana.toKatakana(searchValue);
    const normalizedRomajiHiragana = normalizeSearchText(romajiToHiragana);
    const normalizedRomajiKatakana = normalizeSearchText(romajiToKatakana);

    return accounts.filter((account) => {
      // Normalize account fields
      const normalizedCode = normalizeSearchText(account.code);
      const normalizedName = normalizeSearchText(account.name);
      const normalizedNameKana = account.nameKana ? normalizeSearchText(account.nameKana) : '';

      // Check if search matches any field
      const codeMatch = normalizedCode.includes(normalizedSearch);
      const nameMatch =
        normalizedName.includes(normalizedSearch) ||
        normalizedName.includes(hiraganaSearch) ||
        normalizedName.includes(katakanaSearch) ||
        normalizedName.includes(normalizedRomajiHiragana) ||
        normalizedName.includes(normalizedRomajiKatakana);
      const kanaMatch =
        normalizedNameKana.includes(normalizedSearch) ||
        normalizedNameKana.includes(hiraganaSearch) ||
        normalizedNameKana.includes(katakanaSearch) ||
        normalizedNameKana.includes(normalizedRomajiHiragana) ||
        normalizedNameKana.includes(normalizedRomajiKatakana);

      return codeMatch || nameMatch || kanaMatch;
    });
  }, [accounts, searchValue]);

  const accountTypeLabels: Record<string, string> = {
    ASSET: '資産',
    LIABILITY: '負債',
    EQUITY: '純資産',
    REVENUE: '収益',
    EXPENSE: '費用',
  };

  // Group accounts by type
  const groupedAccounts = React.useMemo(() => {
    const groups: Record<string, Account[]> = {};

    filteredAccounts.forEach((account) => {
      if (!groups[account.accountType]) {
        groups[account.accountType] = [];
      }
      groups[account.accountType].push(account);
    });

    return groups;
  }, [filteredAccounts]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', !selectedAccount && 'text-muted-foreground')}
          disabled={disabled}
        >
          {selectedAccount ? `${selectedAccount.code} - ${selectedAccount.name}` : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="コード、名前、カナ、ローマ字で検索..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>勘定科目が見つかりません</CommandEmpty>
            {Object.entries(groupedAccounts).map(([type, accountsInGroup]) => (
              <CommandGroup key={type} heading={accountTypeLabels[type] || type}>
                {accountsInGroup.map((account) => (
                  <CommandItem
                    key={account.id}
                    value={account.id}
                    onSelect={() => {
                      onValueChange(account.id);
                      setOpen(false);
                      setSearchValue('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === account.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{account.code}</span>
                        <span>{account.name}</span>
                      </div>
                      {account.nameKana && (
                        <div className="text-xs text-muted-foreground">{account.nameKana}</div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
