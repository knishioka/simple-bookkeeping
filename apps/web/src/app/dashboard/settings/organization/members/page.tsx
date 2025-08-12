'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { UserRole } from '@simple-bookkeeping/database';
import { AlertTriangle, Loader2, MoreHorizontal, Plus, Shield, UserMinus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import { apiClient as api } from '@/lib/api-client';

const inviteSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'VIEWER']),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  joinedAt: string;
}

const roleLabels = {
  ADMIN: '管理者',
  ACCOUNTANT: '経理担当',
  VIEWER: '閲覧者',
};

const roleColors = {
  ADMIN: 'destructive',
  ACCOUNTANT: 'default',
  VIEWER: 'secondary',
} as const;

export default function OrganizationMembersPage() {
  const { user, currentOrganization } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.VIEWER);

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: UserRole.VIEWER,
    },
  });

  const currentUserRole = user?.currentOrganization?.role;
  const isAdmin = currentUserRole === 'ADMIN';

  useEffect(() => {
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization]);

  const fetchMembers = async () => {
    if (!currentOrganization) return;

    setIsLoading(true);
    try {
      const response = await api.get<{ data: Member[] }>(
        `/organizations/${currentOrganization.id}/members`
      );
      if (response.data?.data) {
        setMembers(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
      toast.error('メンバー一覧の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const onInviteSubmit = async (data: InviteFormData) => {
    if (!currentOrganization) return;

    setIsInviting(true);
    try {
      await api.post(`/organizations/${currentOrganization.id}/invite`, data);
      toast.success('ユーザーを招待しました');
      setInviteDialogOpen(false);
      form.reset();
      fetchMembers();
    } catch (error) {
      console.error('Failed to invite user:', error);
      const errorMessage =
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'data' in error.response &&
        error.response.data &&
        typeof error.response.data === 'object' &&
        'error' in error.response.data &&
        error.response.data.error &&
        typeof error.response.data.error === 'object' &&
        'message' in error.response.data.error &&
        typeof error.response.data.error.message === 'string'
          ? error.response.data.error.message
          : 'ユーザーの招待に失敗しました';
      toast.error(errorMessage);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!currentOrganization || !selectedMember) return;

    setIsRemoving(true);
    try {
      await api.delete(`/organizations/${currentOrganization.id}/users/${selectedMember.id}`);
      toast.success('メンバーを削除しました');
      setRemoveDialogOpen(false);
      setSelectedMember(null);
      fetchMembers();
    } catch (error) {
      console.error('Failed to remove member:', error);
      const errorMessage =
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'data' in error.response &&
        error.response.data &&
        typeof error.response.data === 'object' &&
        'error' in error.response.data &&
        error.response.data.error &&
        typeof error.response.data.error === 'object' &&
        'message' in error.response.data.error &&
        typeof error.response.data.error.message === 'string'
          ? error.response.data.error.message
          : 'メンバーの削除に失敗しました';
      toast.error(errorMessage);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!currentOrganization || !selectedMember) return;

    setIsUpdatingRole(true);
    try {
      await api.put(`/organizations/${currentOrganization.id}/members/${selectedMember.id}`, {
        role: selectedRole,
      });
      toast.success('ロールを更新しました');
      setRoleDialogOpen(false);
      setSelectedMember(null);
      fetchMembers();
    } catch (error) {
      console.error('Failed to update role:', error);
      const errorMessage =
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'data' in error.response &&
        error.response.data &&
        typeof error.response.data === 'object' &&
        'error' in error.response.data &&
        error.response.data.error &&
        typeof error.response.data.error === 'object' &&
        'message' in error.response.data.error &&
        typeof error.response.data.error.message === 'string'
          ? error.response.data.error.message
          : 'ロールの更新に失敗しました';
      toast.error(errorMessage);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const openRoleDialog = (member: Member) => {
    setSelectedMember(member);
    setSelectedRole(member.role);
    setRoleDialogOpen(true);
  };

  const openRemoveDialog = (member: Member) => {
    setSelectedMember(member);
    setRemoveDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">メンバー管理</h1>
        <p className="mt-2 text-muted-foreground">組織のメンバーとその権限を管理します</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>組織メンバー</CardTitle>
              <CardDescription>
                現在 {members.length} 名のメンバーが登録されています
              </CardDescription>
            </div>
            {isAdmin && (
              <Button onClick={() => setInviteDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                メンバーを招待
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                <TableHead>メールアドレス</TableHead>
                <TableHead>ロール</TableHead>
                <TableHead>参加日</TableHead>
                {isAdmin && <TableHead className="w-[100px]">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isCurrentUser = member.id === user?.id;
                const adminCount = members.filter((m) => m.role === UserRole.ADMIN).length;
                const isLastAdmin = member.role === UserRole.ADMIN && adminCount === 1;

                return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.name || '未設定'}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-muted-foreground">(あなた)</span>
                      )}
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleColors[member.role]}>
                        {member.role === UserRole.ADMIN && <Shield className="mr-1 h-3 w-3" />}
                        {roleLabels[member.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(member.joinedAt).toLocaleDateString('ja-JP')}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        {!isCurrentUser && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>操作</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openRoleDialog(member)}
                                disabled={isLastAdmin}
                              >
                                <Shield className="mr-2 h-4 w-4" />
                                ロール変更
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openRemoveDialog(member)}
                                disabled={isLastAdmin}
                                className="text-destructive"
                              >
                                <UserMinus className="mr-2 h-4 w-4" />
                                削除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>メンバーを招待</DialogTitle>
            <DialogDescription>
              メールアドレスを入力して、新しいメンバーを組織に招待します
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onInviteSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>メールアドレス</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="user@example.com"
                        disabled={isInviting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ロール</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger disabled={isInviting}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={UserRole.ADMIN}>
                          <div className="flex items-center">
                            <Shield className="mr-2 h-4 w-4" />
                            管理者
                          </div>
                        </SelectItem>
                        <SelectItem value={UserRole.ACCOUNTANT}>経理担当</SelectItem>
                        <SelectItem value={UserRole.VIEWER}>閲覧者</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInviteDialogOpen(false)}
                  disabled={isInviting}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={isInviting}>
                  {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  招待
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ロール変更</DialogTitle>
            <DialogDescription>
              {selectedMember?.name || selectedMember?.email} のロールを変更します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">新しいロール</label>
              <Select
                value={selectedRole}
                onValueChange={(value) => setSelectedRole(value as UserRole)}
              >
                <SelectTrigger disabled={isUpdatingRole}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRole.ADMIN}>
                    <div className="flex items-center">
                      <Shield className="mr-2 h-4 w-4" />
                      管理者
                    </div>
                  </SelectItem>
                  <SelectItem value={UserRole.ACCOUNTANT}>経理担当</SelectItem>
                  <SelectItem value={UserRole.VIEWER}>閲覧者</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
              disabled={isUpdatingRole}
            >
              キャンセル
            </Button>
            <Button onClick={handleUpdateRole} disabled={isUpdatingRole}>
              {isUpdatingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              変更
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5 text-destructive" />
              メンバーを削除
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedMember?.name || selectedMember?.email} を組織から削除してもよろしいですか？
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
