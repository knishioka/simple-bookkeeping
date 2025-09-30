import { Printer } from 'lucide-react';
import { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ReportLayoutProps {
  title: string;
  subtitle?: string;
  description?: string;
  children: ReactNode;
  onPrint?: () => void;
  showPrintButton?: boolean;
}

export function ReportLayout({
  title,
  subtitle,
  description,
  children,
  onPrint,
  showPrintButton = true,
}: ReportLayoutProps) {
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex justify-between items-start no-print">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="text-gray-600 mt-2">{subtitle}</p>}
        </div>
        {showPrintButton && (
          <Button onClick={handlePrint} variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            印刷
          </Button>
        )}
      </div>

      <Card className="print:shadow-none">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
