'use client';

import type { ImportHistory } from '@/types/csv-import';

import {
  FileText,
  MoreHorizontal,
  Search,
  Download,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ImportHistoryTableProps {
  imports: ImportHistory[];
  onView?: (importId: string) => void;
  onDelete?: (importId: string) => Promise<void>;
  onReprocess?: (importId: string) => void;
}

export function ImportHistoryTable({
  imports,
  onView,
  onDelete,
  onReprocess,
}: ImportHistoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImport, setSelectedImport] = useState<ImportHistory | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredImports = imports.filter((imp) =>
    imp.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async () => {
    if (!selectedImport || !onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(selectedImport.id);
      setIsDeleteDialogOpen(false);
      setSelectedImport(null);
    } catch (error) {
      console.error('Failed to delete import:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      failed: 'destructive',
      processing: 'secondary',
      pending: 'outline',
    };

    return (
      <Badge variant={variants[status] || 'outline'} className="flex items-center gap-1">
        {getStatusIcon(status)}
        <span className="capitalize">{status}</span>
      </Badge>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search by file name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* History Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>File Name</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rows</TableHead>
              <TableHead>Imported</TableHead>
              <TableHead>Failed</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredImports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No import history found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredImports.map((imp) => (
                <TableRow key={imp.id}>
                  <TableCell>{new Date(imp.created_at).toLocaleDateString('ja-JP')}</TableCell>
                  <TableCell className="font-medium">{imp.file_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{imp.csv_format || 'Unknown'}</Badge>
                  </TableCell>
                  <TableCell>{formatFileSize(imp.file_size)}</TableCell>
                  <TableCell>{getStatusBadge(imp.status)}</TableCell>
                  <TableCell>{imp.total_rows}</TableCell>
                  <TableCell>
                    <span className="text-green-600 font-medium">{imp.imported_rows}</span>
                  </TableCell>
                  <TableCell>
                    {imp.failed_rows > 0 ? (
                      <span className="text-red-600 font-medium">{imp.failed_rows}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onView && (
                          <DropdownMenuItem onClick={() => onView(imp.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                        )}
                        {onReprocess && imp.status === 'failed' && (
                          <DropdownMenuItem onClick={() => onReprocess(imp.id)}>
                            <Clock className="mr-2 h-4 w-4" />
                            Reprocess
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem>
                          <Download className="mr-2 h-4 w-4" />
                          Download Report
                        </DropdownMenuItem>
                        {onDelete && (
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setSelectedImport(imp);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Import History</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this import history? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedImport && (
            <div className="space-y-2 py-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">File:</span>
                <span className="font-medium">{selectedImport.file_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Date:</span>
                <span className="font-medium">
                  {new Date(selectedImport.created_at).toLocaleDateString('ja-JP')}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Imported Rows:</span>
                <span className="font-medium">{selectedImport.imported_rows}</span>
              </div>
            </div>
          )}
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
