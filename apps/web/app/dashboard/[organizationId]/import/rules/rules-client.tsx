'use client';

import type { Database } from '@/lib/supabase/database.types';
import type { ImportRule } from '@/types/csv-import';

import { Plus, Edit2, Trash2, Search, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { createImportRule, updateImportRule, deleteImportRule } from '@/app/actions/csv-import';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Account = Database['public']['Tables']['accounts']['Row'];

interface RulesClientProps {
  organizationId: string;
  initialRules: ImportRule[];
  accounts: Account[];
}

export default function RulesClient({ organizationId, initialRules, accounts }: RulesClientProps) {
  const [rules, setRules] = useState<ImportRule[]>(initialRules);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<ImportRule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    descriptionPattern: '',
    accountId: '',
    contraAccountId: '',
    confidence: 0.7,
  });

  const filteredRules = rules.filter((rule) =>
    rule.description_pattern.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createImportRule(organizationId, formData);
      if (result.success) {
        setRules([...rules, result.data]);
        setIsCreateDialogOpen(false);
        resetForm();
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRule) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await updateImportRule(organizationId, selectedRule.id, {
        description_pattern: formData.descriptionPattern,
        account_id: formData.accountId,
        contra_account_id: formData.contraAccountId,
        confidence: formData.confidence,
      });

      if (result.success) {
        setRules(rules.map((r) => (r.id === selectedRule.id ? result.data : r)));
        setIsEditDialogOpen(false);
        resetForm();
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      const result = await deleteImportRule(organizationId, ruleId);
      if (result.success) {
        setRules(rules.filter((r) => r.id !== ruleId));
      }
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleToggleActive = async (rule: ImportRule) => {
    try {
      const result = await updateImportRule(organizationId, rule.id, {
        is_active: !rule.is_active,
      });
      if (result.success) {
        setRules(rules.map((r) => (r.id === rule.id ? result.data : r)));
      }
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      descriptionPattern: '',
      accountId: '',
      contraAccountId: '',
      confidence: 0.7,
    });
    setSelectedRule(null);
  };

  const openEditDialog = (rule: ImportRule) => {
    setSelectedRule(rule);
    setFormData({
      descriptionPattern: rule.description_pattern,
      accountId: rule.account_id,
      contraAccountId: rule.contra_account_id,
      confidence: rule.confidence || 0.7,
    });
    setIsEditDialogOpen(true);
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Navigation and Actions */}
      <div className="flex items-center justify-between">
        <Link href={`/dashboard/${organizationId}/import`}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Import
          </Button>
        </Link>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Rule
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          placeholder="Search rules..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Rules Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pattern</TableHead>
              <TableHead>Debit Account</TableHead>
              <TableHead>Credit Account</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No import rules found. Create your first rule to get started.
                </TableCell>
              </TableRow>
            ) : (
              filteredRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-mono text-sm">{rule.description_pattern}</TableCell>
                  <TableCell>{getAccountName(rule.account_id)}</TableCell>
                  <TableCell>{getAccountName(rule.contra_account_id)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{Math.round((rule.confidence || 0) * 100)}%</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{rule.usage_count || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.is_active || false}
                      onCheckedChange={() => handleToggleActive(rule)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(rule)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Create Import Rule</DialogTitle>
            <DialogDescription>
              Create a new rule to automatically map accounts during CSV import.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div>
              <Label htmlFor="pattern">Description Pattern</Label>
              <Input
                id="pattern"
                placeholder="e.g., 電気料金, JR, /^ATM.*/"
                value={formData.descriptionPattern}
                onChange={(e) => setFormData({ ...formData, descriptionPattern: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Use plain text for keyword matching or /pattern/ for regex
              </p>
            </div>
            <div>
              <Label htmlFor="debit">Debit Account</Label>
              <Select
                value={formData.accountId}
                onValueChange={(value) => setFormData({ ...formData, accountId: value })}
              >
                <SelectTrigger id="debit">
                  <SelectValue placeholder="Select debit account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="credit">Credit Account</Label>
              <Select
                value={formData.contraAccountId}
                onValueChange={(value) => setFormData({ ...formData, contraAccountId: value })}
              >
                <SelectTrigger id="credit">
                  <SelectValue placeholder="Select credit account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="confidence">
                Confidence: {Math.round(formData.confidence * 100)}%
              </Label>
              <input
                id="confidence"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={formData.confidence}
                onChange={(e) =>
                  setFormData({ ...formData, confidence: parseFloat(e.target.value) })
                }
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                resetForm();
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Edit Import Rule</DialogTitle>
            <DialogDescription>Update the rule configuration.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div>
              <Label htmlFor="edit-pattern">Description Pattern</Label>
              <Input
                id="edit-pattern"
                value={formData.descriptionPattern}
                onChange={(e) => setFormData({ ...formData, descriptionPattern: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-debit">Debit Account</Label>
              <Select
                value={formData.accountId}
                onValueChange={(value) => setFormData({ ...formData, accountId: value })}
              >
                <SelectTrigger id="edit-debit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-credit">Credit Account</Label>
              <Select
                value={formData.contraAccountId}
                onValueChange={(value) => setFormData({ ...formData, contraAccountId: value })}
              >
                <SelectTrigger id="edit-credit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-confidence">
                Confidence: {Math.round(formData.confidence * 100)}%
              </Label>
              <input
                id="edit-confidence"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={formData.confidence}
                onChange={(e) =>
                  setFormData({ ...formData, confidence: parseFloat(e.target.value) })
                }
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                resetForm();
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
