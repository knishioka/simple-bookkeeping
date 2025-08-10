'use client';

import { AuditAction } from '@simple-bookkeeping/database';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Download, Filter, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { useAuth } from '@/contexts/auth-context';

interface AuditLog {
  id: string;
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

interface PaginatedResponse {
  data: AuditLog[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function AuditLogsPage() {
  const { currentOrganization } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entityTypes, setEntityTypes] = useState<string[]>([]);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });

      if (selectedAction !== 'all') {
        params.append('action', selectedAction);
      }

      if (selectedEntityType !== 'all') {
        params.append('entityType', selectedEntityType);
      }

      if (startDate) {
        params.append('startDate', new Date(startDate).toISOString());
      }

      if (endDate) {
        params.append('endDate', new Date(endDate).toISOString());
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/audit-logs?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Organization-ID': currentOrganization?.id || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const data: PaginatedResponse = await response.json();
      setLogs(data.data);
      setTotalPages(data.meta.totalPages);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('監査ログの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [page, selectedAction, selectedEntityType, startDate, endDate, currentOrganization?.id]);

  const fetchEntityTypes = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/audit-logs/entity-types`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Organization-ID': currentOrganization?.id || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch entity types');
      }

      const data = await response.json();
      setEntityTypes(data.data);
    } catch (error) {
      console.error('Error fetching entity types:', error);
    }
  }, [currentOrganization?.id]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();

      if (selectedAction !== 'all') {
        params.append('action', selectedAction);
      }

      if (selectedEntityType !== 'all') {
        params.append('entityType', selectedEntityType);
      }

      if (startDate) {
        params.append('startDate', new Date(startDate).toISOString());
      }

      if (endDate) {
        params.append('endDate', new Date(endDate).toISOString());
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/audit-logs/export?${params}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'X-Organization-ID': currentOrganization?.id || '',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export audit logs');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('監査ログをエクスポートしました');
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      toast.error('エクスポートに失敗しました');
    }
  };

  useEffect(() => {
    if (currentOrganization?.role === 'ADMIN') {
      fetchAuditLogs();
      fetchEntityTypes();
    }
  }, [fetchAuditLogs, fetchEntityTypes, currentOrganization?.role]);

  const getActionLabel = (action: AuditAction): string => {
    const labels: Record<AuditAction, string> = {
      [AuditAction.CREATE]: '作成',
      [AuditAction.UPDATE]: '更新',
      [AuditAction.DELETE]: '削除',
      [AuditAction.APPROVE]: '承認',
    };
    return labels[action] || action;
  };

  // Check if user is admin
  if (currentOrganization?.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>アクセス権限がありません</CardTitle>
            <CardDescription>監査ログの閲覧は管理者権限が必要です。</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const getActionBadgeVariant = (
    action: AuditAction
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (action) {
      case AuditAction.CREATE:
        return 'default';
      case AuditAction.UPDATE:
        return 'secondary';
      case AuditAction.DELETE:
        return 'destructive';
      case AuditAction.APPROVE:
        return 'outline';
      default:
        return 'default';
    }
  };

  const getEntityTypeLabel = (entityType: string): string => {
    const labels: Record<string, string> = {
      JournalEntry: '仕訳',
      Account: '勘定科目',
      User: 'ユーザー',
      Organization: '組織',
      AccountingPeriod: '会計期間',
      Authentication: '認証',
    };
    return labels[entityType] || entityType;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>監査ログ</CardTitle>
          <CardDescription>システムで行われた全ての操作の履歴を確認できます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="操作種別" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value={AuditAction.CREATE}>作成</SelectItem>
                  <SelectItem value={AuditAction.UPDATE}>更新</SelectItem>
                  <SelectItem value={AuditAction.DELETE}>削除</SelectItem>
                  <SelectItem value={AuditAction.APPROVE}>承認</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="対象種別" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  {entityTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getEntityTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Input
              type="date"
              placeholder="開始日"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
            />

            <Input
              type="date"
              placeholder="終了日"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
            />

            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchAuditLogs()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>

            <Button variant="outline" onClick={handleExport} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              エクスポート
            </Button>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日時</TableHead>
                  <TableHead>ユーザー</TableHead>
                  <TableHead>操作</TableHead>
                  <TableHead>対象</TableHead>
                  <TableHead>対象ID</TableHead>
                  <TableHead>IPアドレス</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      監査ログがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: ja })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{log.user.email}</div>
                          {(log.user.lastName || log.user.firstName) && (
                            <div className="text-sm text-muted-foreground">
                              {log.user.lastName} {log.user.firstName}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action)}>
                          {getActionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell>{getEntityTypeLabel(log.entityType)}</TableCell>
                      <TableCell className="font-mono text-sm">{log.entityId}</TableCell>
                      <TableCell className="font-mono text-sm">{log.ipAddress || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                ページ {page} / {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  前へ
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages || loading}
                >
                  次へ
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
