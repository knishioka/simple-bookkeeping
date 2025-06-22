import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatAmount } from '@/lib/formatters';

export interface ReportItem {
  id?: string;
  name: string;
  code?: string;
  amount: number;
  level?: number;
  isTotal?: boolean;
  children?: ReportItem[];
}

interface ReportTableProps {
  items: ReportItem[];
  showCode?: boolean;
  emptyMessage?: string;
}

export function ReportTable({
  items,
  showCode = true,
  emptyMessage = 'データがありません',
}: ReportTableProps) {
  if (items.length === 0) {
    return <div className="text-center py-8 text-gray-500">{emptyMessage}</div>;
  }

  const renderRow = (item: ReportItem, index: number) => {
    const indentStyle = item.level ? { paddingLeft: `${item.level * 20}px` } : {};

    return (
      <TableRow key={item.id || index} className={item.isTotal ? 'font-bold bg-gray-50' : ''}>
        {showCode && <TableCell>{item.code || ''}</TableCell>}
        <TableCell style={indentStyle}>{item.name}</TableCell>
        <TableCell className="text-right">{formatAmount(item.amount)}</TableCell>
      </TableRow>
    );
  };

  const renderRows = (items: ReportItem[]): JSX.Element[] => {
    const rows: JSX.Element[] = [];

    items.forEach((item, index) => {
      rows.push(renderRow(item, index));

      if (item.children && item.children.length > 0) {
        const childRows = renderRows(item.children);
        rows.push(...childRows);
      }
    });

    return rows;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showCode && <TableHead className="w-32">コード</TableHead>}
          <TableHead>項目</TableHead>
          <TableHead className="text-right w-40">金額</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{renderRows(items)}</TableBody>
    </Table>
  );
}
