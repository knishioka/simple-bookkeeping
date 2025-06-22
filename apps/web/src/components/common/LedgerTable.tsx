import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatAmount } from '@/lib/formatters';

export interface LedgerEntry {
  id: string;
  entryDate: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
  accountCode?: string;
  accountName?: string;
  journalEntry?: {
    description: string;
  };
}

interface LedgerTableProps {
  entries: LedgerEntry[];
  showAccount?: boolean;
  emptyMessage?: string;
}

export function LedgerTable({
  entries,
  showAccount = false,
  emptyMessage = 'データがありません',
}: LedgerTableProps) {
  if (entries.length === 0) {
    return <div className="text-center py-8 text-gray-500">{emptyMessage}</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>日付</TableHead>
          {showAccount && (
            <>
              <TableHead>科目コード</TableHead>
              <TableHead>科目名</TableHead>
            </>
          )}
          <TableHead>摘要</TableHead>
          <TableHead className="text-right">借方</TableHead>
          <TableHead className="text-right">貸方</TableHead>
          <TableHead className="text-right">残高</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell>{formatDate(entry.entryDate)}</TableCell>
            {showAccount && (
              <>
                <TableCell>{entry.accountCode}</TableCell>
                <TableCell>{entry.accountName}</TableCell>
              </>
            )}
            <TableCell>{entry.journalEntry?.description || entry.description}</TableCell>
            <TableCell className="text-right">
              {entry.debitAmount > 0 ? formatAmount(entry.debitAmount) : '-'}
            </TableCell>
            <TableCell className="text-right">
              {entry.creditAmount > 0 ? formatAmount(entry.creditAmount) : '-'}
            </TableCell>
            <TableCell className="text-right font-medium">{formatAmount(entry.balance)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
