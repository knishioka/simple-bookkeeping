'use client';

import { AuditAction } from '@simple-bookkeeping/database';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Download, Filter, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import {
  getAuditLogs,
  getEntityTypes,
  exportAuditLogs,
  type AuditLog,
  type AuditLogFilter,
  type EntityType,
} from '@/app/actions/audit-logs';
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
import { createClient } from '@/lib/supabase/client';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Get current user and organization info
  useEffect(() => {
    const checkAuthAndOrg = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          console.error('Auth error:', authError);
          setAuthLoading(false);
          return;
        }

        if (user) {
          // Get user's organization and role
          const { data: userOrg, error: orgError } = await supabase
            .from('user_organizations')
            .select('organization_id, role')
            .eq('user_id', user.id)
            .single<{ organization_id: string; role: string }>();

          if (orgError) {
            console.error('Organization fetch error:', orgError);
            setAuthLoading(false);
            return;
          }

          if (userOrg) {
            setOrganizationId(userOrg.organization_id);
            setUserRole(userOrg.role);
          }
        } else {
          // No user - set role to null to show access denied
          setUserRole(null);
        }
      } catch (error) {
        console.error('Error checking auth and org:', error);
        setUserRole(null);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuthAndOrg();
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);

      const filter: AuditLogFilter = {
        page,
        pageSize: 50,
      };

      if (selectedAction !== 'all') {
        filter.action = selectedAction as AuditAction;
      }

      if (selectedEntityType !== 'all') {
        filter.entityType = selectedEntityType as EntityType;
      }

      if (startDate) {
        filter.startDate = new Date(startDate).toISOString();
      }

      if (endDate) {
        filter.endDate = new Date(endDate).toISOString();
      }

      const result = await getAuditLogs(organizationId, filter);

      if (result.success) {
        setLogs(result.data.items);
        setTotalPages(result.data.pagination.totalPages);
      } else {
        toast.error(result.error.message || '監査ログの取得に失敗しました');
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('監査ログの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [page, selectedAction, selectedEntityType, startDate, endDate, organizationId]);

  const fetchEntityTypes = useCallback(async () => {
    if (!organizationId) return;

    try {
      const result = await getEntityTypes(organizationId);

      if (result.success) {
        setEntityTypes(result.data);
      }
    } catch (error) {
      console.error('Error fetching entity types:', error);
    }
  }, [organizationId]);

  const handleExport = async () => {
    if (!organizationId) return;

    try {
      const filter: AuditLogFilter = {};

      if (selectedAction !== 'all') {
        filter.action = selectedAction as AuditAction;
      }

      if (selectedEntityType !== 'all') {
        filter.entityType = selectedEntityType as EntityType;
      }

      if (startDate) {
        filter.startDate = new Date(startDate).toISOString();
      }

      if (endDate) {
        filter.endDate = new Date(endDate).toISOString();
      }

      const result = await exportAuditLogs(organizationId, filter, {
        format: 'csv',
        includeUserDetails: true,
      });

      if (result.success) {
        // Create a Blob from the CSV string
        const blob = new Blob([result.data as string], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success('監査ログをエクスポートしました');
      } else {
        toast.error(result.error.message || 'エクスポートに失敗しました');
      }
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      toast.error('エクスポートに失敗しました');
    }
  };

  useEffect(() => {
    if (organizationId && userRole === 'admin') {
      fetchAuditLogs();
      fetchEntityTypes();
    }
  }, [fetchAuditLogs, fetchEntityTypes, organizationId, userRole]);

  const getActionLabel = (action: AuditAction): string => {
    const labels: Record<AuditAction, string> = {
      [AuditAction.CREATE]: '作成',
      [AuditAction.UPDATE]: '更新',
      [AuditAction.DELETE]: '削除',
      [AuditAction.APPROVE]: '承認',
    };
    return labels[action] || action;
  };

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check if user is admin
  if (userRole !== null && userRole !== 'admin') {
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
      account: '勘定科目',
      journal_entry: '仕訳',
      journal_entry_line: '仕訳明細',
      organization: '組織',
      user: 'ユーザー',
      accounting_period: '会計期間',
      report: 'レポート',
      // Legacy entity types (for compatibility)
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
          <CardTitle className="text-2xl">監査ログ</CardTitle>
          <CardDescription>システムで行われた全ての操作の履歴を確認できます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedAction}
                onValueChange={setSelectedAction}
                data-testid="audit-action-filter"
              >
                <SelectTrigger className="w-32" data-testid="audit-action-trigger">
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
              <Select
                value={selectedEntityType}
                onValueChange={setSelectedEntityType}
                data-testid="audit-entity-filter"
              >
                <SelectTrigger className="w-40" data-testid="audit-entity-trigger">
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
              data-testid="audit-refresh-button"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                data-testid={loading ? 'loading' : undefined}
              />
            </Button>

            <Button
              variant="outline"
              onClick={handleExport}
              disabled={loading}
              data-testid="audit-export-button"
            >
              <Download className="h-4 w-4 mr-2" />
              エクスポート
            </Button>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table data-testid="audit-logs-table">
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
                          <div className="font-medium">{log.user?.email || log.userId}</div>
                          {log.user?.name && (
                            <div className="text-sm text-muted-foreground">{log.user.name}</div>
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
