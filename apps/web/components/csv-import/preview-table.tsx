'use client';

import type { Database } from '@/lib/supabase/database.types';
import type { ParsedCsvRow, AccountMapping } from '@/types/csv-import';

import { AlertCircle, CheckCircle, AlertTriangle, FileText, ArrowUpDown } from 'lucide-react';
import { useState, useMemo } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Account = Database['public']['Tables']['accounts']['Row'];

interface PreviewTableProps {
  rows: ParsedCsvRow[];
  mappings: AccountMapping[];
  accounts: Account[];
  onMappingChange: (rowIndex: number, accountId: string, contraAccountId: string) => void;
  onImport: (selectedRows: number[]) => Promise<void>;
  isImporting?: boolean;
}

export function PreviewTable({
  rows,
  mappings,
  accounts,
  onMappingChange,
  onImport,
  isImporting = false,
}: PreviewTableProps) {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<'date' | 'amount' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Group accounts by type for better organization
  const accountsByType = useMemo(() => {
    const grouped: Record<string, Account[]> = {};
    accounts.forEach((account) => {
      const type = account.account_type || 'その他';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(account);
    });
    return grouped;
  }, [accounts]);

  // Sort rows
  const sortedRows = useMemo(() => {
    if (!sortField) return rows;

    const sorted = [...rows].sort((a, b) => {
      let aVal: Date | number = a[sortField];
      let bVal: Date | number = b[sortField];

      if (sortField === 'date') {
        aVal = (aVal as Date).getTime();
        bVal = (bVal as Date).getTime();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [rows, sortField, sortDirection]);

  const handleSort = (field: 'date' | 'amount') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(rows.map((_, index) => index)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (rowIndex: number, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(rowIndex);
    } else {
      newSelected.delete(rowIndex);
    }
    setSelectedRows(newSelected);
  };

  const handleImport = async () => {
    const rowsToImport =
      selectedRows.size > 0 ? Array.from(selectedRows) : rows.map((_, index) => index);

    await onImport(rowsToImport);
  };

  const duplicateCount = mappings.filter((m) => m.isDuplicate).length;
  const mappedCount = mappings.filter((m) => m.accountId && m.contraAccountId).length;

  return (
    <div className="space-y-4">
      {/* Summary Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total Rows</p>
              <p className="text-2xl font-semibold">{rows.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Mapped</p>
              <p className="text-2xl font-semibold">{mappedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-sm text-gray-600">Duplicates</p>
              <p className="text-2xl font-semibold">{duplicateCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-gray-600" />
            <div>
              <p className="text-sm text-gray-600">Selected</p>
              <p className="text-2xl font-semibold">{selectedRows.size}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Duplicate Warning */}
      {duplicateCount > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {duplicateCount} potential duplicate transactions detected. These rows are highlighted
            in yellow. Review them carefully before importing.
          </AlertDescription>
        </Alert>
      )}

      {/* Preview Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedRows.size === rows.length && rows.length > 0}
                  onCheckedChange={handleSelectAll}
                  disabled={isImporting}
                />
              </TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('date')}
                  className="h-auto p-0 font-medium"
                >
                  Date
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Description</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('amount')}
                  className="h-auto p-0 font-medium"
                >
                  Amount
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Debit Account</TableHead>
              <TableHead>Credit Account</TableHead>
              <TableHead>Confidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row, index) => {
              const mapping = mappings[index];
              const isDuplicate = mapping?.isDuplicate || false;
              const confidence = mapping?.confidence || 0;

              return (
                <TableRow key={index} className={isDuplicate ? 'bg-yellow-50' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={selectedRows.has(index)}
                      onCheckedChange={(checked: boolean) => handleSelectRow(index, checked)}
                      disabled={isImporting}
                    />
                  </TableCell>
                  <TableCell>
                    {isDuplicate ? (
                      <Badge variant="outline" className="bg-yellow-100">
                        Duplicate
                      </Badge>
                    ) : mapping?.accountId && mapping?.contraAccountId ? (
                      <Badge variant="outline" className="bg-green-100">
                        Ready
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-100">
                        Unmapped
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{row.date.toLocaleDateString('ja-JP')}</TableCell>
                  <TableCell className="max-w-xs truncate" title={row.description}>
                    {row.description}
                  </TableCell>
                  <TableCell className="text-right">
                    ¥{row.amount.toLocaleString('ja-JP')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.type === 'income' ? 'default' : 'secondary'}>
                      {row.type === 'income' ? '収入' : '支出'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={mapping?.accountId || ''}
                      onValueChange={(value) =>
                        onMappingChange(index, value, mapping?.contraAccountId || '')
                      }
                      disabled={isImporting}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(accountsByType).map(([type, accs]) => (
                          <div key={type}>
                            <div className="px-2 py-1 text-xs font-semibold text-gray-500">
                              {type}
                            </div>
                            {accs.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={mapping?.contraAccountId || ''}
                      onValueChange={(value) =>
                        onMappingChange(index, mapping?.accountId || '', value)
                      }
                      disabled={isImporting}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(accountsByType).map(([type, accs]) => (
                          <div key={type}>
                            <div className="px-2 py-1 text-xs font-semibold text-gray-500">
                              {type}
                            </div>
                            {accs.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {confidence > 0 && (
                      <div className="flex items-center space-x-1">
                        <Progress value={confidence * 100} className="w-16 h-2" />
                        <span className="text-xs text-gray-500">
                          {Math.round(confidence * 100)}%
                        </span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          {selectedRows.size > 0
            ? `${selectedRows.size} rows selected for import`
            : 'All rows will be imported'}
        </p>
        <div className="space-x-2">
          <Button variant="outline" disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isImporting || mappedCount === 0}>
            {isImporting ? 'Importing...' : `Import ${selectedRows.size || rows.length} Rows`}
          </Button>
        </div>
      </div>
    </div>
  );
}
