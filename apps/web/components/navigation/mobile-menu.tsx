'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface NavigationItem {
  name: string;
  href: string;
  children?: NavigationItem[];
}

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  navigation: NavigationItem[];
  pathname: string;
}

export function MobileMenu({ isOpen, onClose, navigation, pathname }: MobileMenuProps) {
  const [openItems, setOpenItems] = useState<string[]>([]);

  const toggleItem = (name: string) => {
    setOpenItems((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-[300px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>メニュー</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col space-y-1">
          {navigation.map((item) =>
            item.children ? (
              <Collapsible
                key={item.name}
                open={openItems.includes(item.name)}
                onOpenChange={() => toggleItem(item.name)}
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100">
                  <span
                    className={pathname.startsWith(item.href) ? 'text-indigo-600' : 'text-gray-700'}
                  >
                    {item.name}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      openItems.includes(item.name) ? 'rotate-180' : ''
                    }`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="ml-4 mt-1 space-y-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.name}
                      href={child.href}
                      onClick={onClose}
                      className={`block rounded-md px-3 py-2 text-sm ${
                        pathname === child.href
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {child.name}
                    </Link>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  pathname === item.href
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.name}
              </Link>
            )
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
