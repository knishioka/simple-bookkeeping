'use server';

import type { Database } from '@/lib/supabase/database.types';
import type {
  ImportHistory,
  ImportHistoryInsert,
  ImportHistoryUpdate,
  ImportRule,
  ImportRuleInsert,
  CsvTemplate,
  ParsedCsvRow,
  CsvPreviewData,
  AccountMapping,
  ImportExecutionRequest,
  ImportSummary,
  ImportRuleCreateRequest,
  AccountSuggestion,
} from '@/types/csv-import';

import { revalidatePath } from 'next/cache';

import {
  ActionResult,
  QueryParams,
  PaginatedResponse,
  createSuccessResult,
  createErrorResult,
  createUnauthorizedResult,
  createNotFoundResult,
  createValidationErrorResult,
  handleSupabaseError,
  ERROR_CODES,
} from './types';

import { classifyTransaction } from '@/lib/ai-classifier';
import { parseCsvData, convertToParsedRows, detectCsvTemplate } from '@/lib/csv-parser';
import { detectDuplicates } from '@/lib/duplicate-detector';
import { createClient, createServiceClient } from '@/lib/supabase/server';

type Account = Database['public']['Tables']['accounts']['Row'];

/**
 * Upload and parse CSV file
 */
export async function uploadCsvFile(
  organizationId: string,
  fileBuffer: Buffer,
  fileName: string,
  fileSize: number,
  templateId?: string
): Promise<ActionResult<ImportHistory>> {
  try {
    const supabase = await createClient();

    // Validate file content
    if (!fileBuffer || fileBuffer.length === 0) {
      return createErrorResult(ERROR_CODES.VALIDATION_ERROR, 'ファイルが空です');
    }

    // Check basic CSV structure
    const tempContent = fileBuffer.toString('utf-8').trim();
    if (!tempContent) {
      return createErrorResult(ERROR_CODES.VALIDATION_ERROR, 'ファイルにコンテンツがありません');
    }

    // Check if file has some delimiter structure (comma, tab, or semicolon)
    const firstLines = tempContent.split('\n').slice(0, 3).join('\n');
    if (!firstLines.includes(',') && !firstLines.includes('\t') && !firstLines.includes(';')) {
      return createErrorResult(
        ERROR_CODES.VALIDATION_ERROR,
        'CSVファイルとして認識できません。有効な区切り文字（カンマ、タブ、セミコロン）が見つかりません'
      );
    }

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return createUnauthorizedResult();
    }

    // Check organization access
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (orgError || !userOrg) {
      return createErrorResult(
        ERROR_CODES.FORBIDDEN,
        'You do not have permission to import data for this organization.'
      );
    }

    // Get CSV template if specified
    let template: CsvTemplate | null = null;
    if (templateId) {
      const { data: templateData, error: templateError } = await supabase
        .from('csv_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (!templateError && templateData) {
        template = templateData as CsvTemplate;
      }
    }

    // If no template specified, try to auto-detect
    if (!template) {
      const { data: templates } = await supabase
        .from('csv_templates')
        .select('*')
        .eq('is_active', true);

      if (templates && templates.length > 0) {
        template = await detectCsvTemplate(fileBuffer, templates as CsvTemplate[]);
      }
    }

    // Parse CSV with template settings
    const parseOptions = template
      ? {
          encoding: (template.encoding || 'UTF-8') as
            | 'UTF-8'
            | 'Shift-JIS'
            | 'EUC-JP'
            | 'ISO-2022-JP',
          delimiter: template.delimiter || ',',
          skipRows: template.skip_rows || 0,
          dateFormat: template.date_format,
        }
      : {};

    const { data: rawData, errors } = await parseCsvData(fileBuffer, parseOptions);

    if (errors.length > 0 && rawData.length === 0) {
      return createErrorResult(ERROR_CODES.VALIDATION_ERROR, errors.join(', '));
    }

    // Convert to parsed rows
    const parsedRows = convertToParsedRows(
      rawData,
      template,
      template?.date_format || 'YYYY-MM-DD'
    );

    // Create import history record
    const serviceSupabase = createServiceClient();
    const importHistoryData: ImportHistoryInsert = {
      organization_id: organizationId,
      user_id: user.id,
      file_name: fileName,
      file_size: fileSize,
      csv_format: template?.template_name || 'unknown',
      total_rows: parsedRows.length,
      imported_rows: 0,
      failed_rows: 0,
      status: 'pending',
      file_data: { rows: parsedRows, template: template?.id },
    };
    const { data: importHistory, error: insertError } = (await serviceSupabase
      .from('import_history' as never)
      .insert(importHistoryData as never)
      .select()
      .single()) as { data: ImportHistory | null; error: Error | null };

    if (insertError || !importHistory) {
      return handleSupabaseError(insertError || new Error('Failed to create import history'));
    }

    return createSuccessResult(importHistory as ImportHistory);
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * Get import preview with account suggestions
 */
export async function previewImport(
  organizationId: string,
  importId: string
): Promise<ActionResult<{ preview: CsvPreviewData; mappings: AccountMapping[] }>> {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return createUnauthorizedResult();
    }

    // Get import history
    const { data: importHistory, error: historyError } = await supabase
      .from('import_history')
      .select('*')
      .eq('id', importId)
      .eq('organization_id', organizationId)
      .single();

    if (historyError || !importHistory) {
      return createNotFoundResult('Import history');
    }

    // Get parsed data from import history
    const fileData = importHistory.file_data as { rows: ParsedCsvRow[]; template?: string } | null;
    const parsedRows: ParsedCsvRow[] = fileData?.rows || [];

    // Get template if available
    let template: CsvTemplate | null = null;
    if (fileData?.template) {
      const { data: templateData } = await supabase
        .from('csv_templates')
        .select('*')
        .eq('id', fileData.template)
        .single();

      template = templateData as CsvTemplate | null;
    }

    // Detect duplicates
    const duplicates = await detectDuplicates(organizationId, parsedRows);

    // Get accounts for organization
    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('organization_id', organizationId)
      .order('code');

    // Get import rules for organization
    const { data: rules } = await supabase
      .from('import_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    // Generate account mappings with suggestions
    const mappings: AccountMapping[] = [];
    const useAI = !!process.env.OPENAI_API_KEY;

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const duplicate = duplicates.get(i);

      // Get account suggestion
      let suggestion: AccountSuggestion | null = null;
      if (accounts && rules) {
        suggestion = await classifyTransaction(
          row.description,
          row.amount,
          row.type,
          rules as ImportRule[],
          accounts as Account[],
          useAI
        );
      }

      mappings.push({
        rowIndex: i,
        accountId: suggestion?.accountId || '',
        contraAccountId: suggestion?.contraAccountId || '',
        confidence: suggestion?.confidence || 0,
        isDuplicate: duplicate?.isDuplicate || false,
        duplicateDetails: duplicate?.duplicateDetails
          ? {
              journalEntryId: duplicate.journalEntryId || '',
              date: duplicate.duplicateDetails.date,
              amount: duplicate.duplicateDetails.amount,
              description: duplicate.duplicateDetails.description,
            }
          : undefined,
      });
    }

    // Create preview data
    const preview: CsvPreviewData = {
      rows: parsedRows,
      columns: parsedRows.length > 0 ? Object.keys(parsedRows[0].originalRow) : [],
      totalRows: parsedRows.length,
      template,
      errors: [],
    };

    return createSuccessResult({ preview, mappings });
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * Execute CSV import and create journal entries
 */
export async function executeImport(
  organizationId: string,
  request: ImportExecutionRequest
): Promise<ActionResult<ImportSummary>> {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return createUnauthorizedResult();
    }

    // Check organization access
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (orgError || !userOrg || !['owner', 'admin', 'member'].includes(userOrg.role)) {
      return createErrorResult(
        ERROR_CODES.FORBIDDEN,
        'You do not have permission to import data for this organization.'
      );
    }

    // Get import history
    const { data: importHistory, error: historyError } = await supabase
      .from('import_history')
      .select('*')
      .eq('id', request.importId)
      .eq('organization_id', organizationId)
      .single();

    if (historyError || !importHistory) {
      return createNotFoundResult('Import history');
    }

    // Check if already processed
    if (importHistory.status === 'completed') {
      return createErrorResult(
        ERROR_CODES.INVALID_OPERATION,
        'This import has already been processed.'
      );
    }

    // Get parsed rows
    const fileData = importHistory.file_data as { rows: ParsedCsvRow[]; template?: string } | null;
    const parsedRows: ParsedCsvRow[] = fileData?.rows || [];

    // Get current accounting period
    const { data: accountingPeriod } = await supabase
      .from('accounting_periods')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_closed', false)
      .order('start_date', { ascending: false })
      .limit(1)
      .single();

    if (!accountingPeriod) {
      return createErrorResult(
        ERROR_CODES.INVALID_OPERATION,
        'No open accounting period found. Please create an accounting period first.'
      );
    }

    // Use service client for bulk operations
    const serviceSupabase = createServiceClient();

    // Update import status to processing
    const statusUpdate: ImportHistoryUpdate = { status: 'processing' };
    await serviceSupabase
      .from('import_history' as never)
      .update(statusUpdate as never)
      .eq('id', request.importId);

    const createdJournalEntries: string[] = [];
    const errors: Array<{ row: number; error: string }> = [];
    let importedRows = 0;
    let skippedRows = 0;
    let failedRows = 0;

    // TODO: Implement proper database transaction handling
    // Supabase doesn't support multi-statement transactions in the same way as raw SQL.
    // Current approach uses bulk inserts for better performance and partial atomicity.
    // For full transaction support, consider:
    // 1. Using Supabase Edge Functions with database connection pooling
    // 2. Implementing retry logic with exponential backoff
    // 3. Adding cleanup mechanism for orphaned journal entries
    // See follow-up issue for implementing comprehensive transaction handling.

    // Prepare bulk data
    const journalEntriesToInsert: Array<{
      organization_id: string;
      accounting_period_id: string;
      date: string;
      description: string;
      amount: number;
      created_by: string;
      updated_by: string;
    }> = [];
    const journalLinesToPrepare: Array<{
      mappingIndex: number;
      accountId: string;
      contraAccountId: string;
      amount: number;
      description: string;
      type: 'income' | 'expense' | undefined;
    }> = [];
    const importRulesToInsert: ImportRuleInsert[] = [];

    // First pass: Validate and prepare data
    for (const mapping of request.mappings) {
      const row = parsedRows[mapping.rowIndex];
      if (!row) continue;

      // Skip duplicates if requested
      if (mapping.isDuplicate && request.skipDuplicates) {
        skippedRows++;
        continue;
      }

      // Validate mapping
      if (!mapping.accountId || !mapping.contraAccountId) {
        errors.push({
          row: mapping.rowIndex,
          error: 'Missing account mapping',
        });
        failedRows++;
        continue;
      }

      // Prepare journal entry data
      journalEntriesToInsert.push({
        organization_id: organizationId,
        accounting_period_id: accountingPeriod.id,
        date: row.date.toISOString(),
        description: row.description,
        amount: row.amount,
        created_by: user.id,
        updated_by: user.id,
      });

      // Prepare line data for later processing
      journalLinesToPrepare.push({
        mappingIndex: journalLinesToPrepare.length,
        accountId: mapping.accountId,
        contraAccountId: mapping.contraAccountId,
        amount: row.amount,
        description: row.description,
        type: row.type,
      });

      // Prepare import rules if requested
      if (request.createRulesFromMappings && (mapping.confidence || 0) < 0.8) {
        importRulesToInsert.push({
          organization_id: organizationId,
          description_pattern: row.description.substring(0, 50),
          account_id: mapping.accountId,
          contra_account_id: mapping.contraAccountId,
          confidence: 0.7,
          usage_count: 1,
        });
      }
    }

    // Bulk insert journal entries if we have any
    if (journalEntriesToInsert.length > 0) {
      try {
        const { data: insertedEntries, error: bulkInsertError } = (await serviceSupabase
          .from('journal_entries' as never)
          .insert(journalEntriesToInsert as never)
          .select('id')) as { data: Array<{ id: string }> | null; error: Error | null };

        if (bulkInsertError || !insertedEntries) {
          // If bulk insert fails, fall back to updating status as failed
          const errorMessage = bulkInsertError?.message || 'Failed to create journal entries';
          errors.push({ row: -1, error: errorMessage });
          failedRows = journalEntriesToInsert.length;
        } else {
          // Prepare journal entry lines with the inserted IDs
          const allLines: Array<{
            journal_entry_id: string;
            account_id: string;
            debit_amount: number;
            credit_amount: number;
            description: string;
          }> = [];

          for (let i = 0; i < insertedEntries.length; i++) {
            const entry = insertedEntries[i];
            const lineData = journalLinesToPrepare[i];

            if (lineData.type === 'income') {
              // Debit: Bank account, Credit: Revenue account
              allLines.push(
                {
                  journal_entry_id: entry.id,
                  account_id: lineData.accountId,
                  debit_amount: lineData.amount,
                  credit_amount: 0,
                  description: lineData.description,
                },
                {
                  journal_entry_id: entry.id,
                  account_id: lineData.contraAccountId,
                  debit_amount: 0,
                  credit_amount: lineData.amount,
                  description: lineData.description,
                }
              );
            } else {
              // Debit: Expense account, Credit: Bank account
              allLines.push(
                {
                  journal_entry_id: entry.id,
                  account_id: lineData.accountId,
                  debit_amount: lineData.amount,
                  credit_amount: 0,
                  description: lineData.description,
                },
                {
                  journal_entry_id: entry.id,
                  account_id: lineData.contraAccountId,
                  debit_amount: 0,
                  credit_amount: lineData.amount,
                  description: lineData.description,
                }
              );
            }

            createdJournalEntries.push(entry.id);
          }

          // Bulk insert all journal entry lines
          const { error: linesError } = await serviceSupabase
            .from('journal_entry_lines' as never)
            .insert(allLines as never);

          if (linesError) {
            // Log error but don't fail the entire import
            errors.push({
              row: -1,
              error: `Failed to create journal entry lines: ${linesError.message}`,
            });
          } else {
            importedRows = insertedEntries.length;
          }

          // Insert import rules if any (non-critical, so we don't check errors)
          if (importRulesToInsert.length > 0) {
            await serviceSupabase
              .from('import_rules' as never)
              .insert(importRulesToInsert as never);
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error during bulk import';
        errors.push({ row: -1, error: errorMessage });
        failedRows = journalEntriesToInsert.length;
      }
    }

    // Update import history with results
    const updateStatus = failedRows === 0 ? 'completed' : 'failed';
    const historyUpdate: ImportHistoryUpdate = {
      status: updateStatus,
      imported_rows: importedRows,
      failed_rows: failedRows,
      error_message: errors.length > 0 ? JSON.stringify(errors) : null,
    };
    await serviceSupabase
      .from('import_history' as never)
      .update(historyUpdate as never)
      .eq('id', request.importId);

    // Revalidate relevant pages
    revalidatePath(`/dashboard/${organizationId}/journal-entries`);
    revalidatePath(`/dashboard/${organizationId}/import`);

    const summary: ImportSummary = {
      totalRows: request.mappings.length,
      importedRows,
      failedRows,
      skippedRows,
      createdJournalEntries,
      errors: errors.length > 0 ? errors : undefined,
    };

    return createSuccessResult(summary);
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * Get import history for organization
 */
export async function getImportHistory(
  organizationId: string,
  params?: QueryParams
): Promise<ActionResult<PaginatedResponse<ImportHistory>>> {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return createUnauthorizedResult();
    }

    // Check organization access
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (orgError || !userOrg) {
      return createErrorResult(
        ERROR_CODES.FORBIDDEN,
        'You do not have permission to view import history for this organization.'
      );
    }

    // Build query
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('import_history')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId);

    // Apply search filter
    if (params?.search) {
      query = query.ilike('file_name', `%${params.search}%`);
    }

    // Apply sorting
    const orderBy = params?.orderBy || 'created_at';
    const orderDirection = params?.orderDirection === 'asc';
    query = query.order(orderBy, { ascending: orderDirection });

    // Apply pagination
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return handleSupabaseError(error);
    }

    return createSuccessResult({
      items: (data || []) as ImportHistory[],
      pagination: {
        page,
        pageSize,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * Create import rule
 */
export async function createImportRule(
  organizationId: string,
  request: ImportRuleCreateRequest
): Promise<ActionResult<ImportRule>> {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return createUnauthorizedResult();
    }

    // Check organization access (admin only)
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (orgError || !userOrg || !['owner', 'admin'].includes(userOrg.role)) {
      return createErrorResult(
        ERROR_CODES.FORBIDDEN,
        'Only administrators can create import rules.'
      );
    }

    // Validate accounts exist
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('organization_id', organizationId)
      .in('id', [request.accountId, request.contraAccountId]);

    if (!accounts || accounts.length !== 2) {
      return createValidationErrorResult('Invalid account IDs provided.');
    }

    // Create rule using service client
    const serviceSupabase = createServiceClient();
    const importRuleData: ImportRuleInsert = {
      organization_id: organizationId,
      description_pattern: request.descriptionPattern,
      account_id: request.accountId,
      contra_account_id: request.contraAccountId,
      confidence: request.confidence || 0.7,
      usage_count: 0,
      is_active: true,
    };
    const { data: rule, error: insertError } = (await serviceSupabase
      .from('import_rules' as never)
      .insert(importRuleData as never)
      .select()
      .single()) as { data: ImportRule | null; error: Error | null };

    if (insertError || !rule) {
      return handleSupabaseError(insertError || new Error('Failed to create import rule'));
    }

    revalidatePath(`/dashboard/${organizationId}/import/rules`);

    return createSuccessResult(rule as ImportRule);
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * Get import rules for organization
 */
export async function getImportRules(organizationId: string): Promise<ActionResult<ImportRule[]>> {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return createUnauthorizedResult();
    }

    // Check organization access
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (orgError || !userOrg) {
      return createErrorResult(
        ERROR_CODES.FORBIDDEN,
        'You do not have permission to view import rules for this organization.'
      );
    }

    const { data: rules, error } = await supabase
      .from('import_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .order('usage_count', { ascending: false });

    if (error) {
      return handleSupabaseError(error);
    }

    return createSuccessResult((rules || []) as ImportRule[]);
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * Update import rule
 */
export async function updateImportRule(
  organizationId: string,
  ruleId: string,
  updates: Partial<ImportRule>
): Promise<ActionResult<ImportRule>> {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return createUnauthorizedResult();
    }

    // Check organization access (admin only)
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (orgError || !userOrg || !['owner', 'admin'].includes(userOrg.role)) {
      return createErrorResult(
        ERROR_CODES.FORBIDDEN,
        'Only administrators can update import rules.'
      );
    }

    // Update rule using service client
    const serviceSupabase = createServiceClient();
    const { data: rule, error: updateError } = (await serviceSupabase
      .from('import_rules' as never)
      .update(updates as never)
      .eq('id', ruleId)
      .eq('organization_id', organizationId)
      .select()
      .single()) as { data: ImportRule | null; error: Error | null };

    if (updateError || !rule) {
      return handleSupabaseError(updateError || new Error('Failed to update import rule'));
    }

    revalidatePath(`/dashboard/${organizationId}/import/rules`);

    return createSuccessResult(rule as ImportRule);
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * Delete import rule
 */
export async function deleteImportRule(
  organizationId: string,
  ruleId: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return createUnauthorizedResult();
    }

    // Check organization access (admin only)
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (orgError || !userOrg || !['owner', 'admin'].includes(userOrg.role)) {
      return createErrorResult(
        ERROR_CODES.FORBIDDEN,
        'Only administrators can delete import rules.'
      );
    }

    // Delete rule using service client
    const serviceSupabase = createServiceClient();
    const { error: deleteError } = await serviceSupabase
      .from('import_rules')
      .delete()
      .eq('id', ruleId)
      .eq('organization_id', organizationId);

    if (deleteError) {
      return handleSupabaseError(deleteError);
    }

    revalidatePath(`/dashboard/${organizationId}/import/rules`);

    return createSuccessResult({ success: true });
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * Get available CSV templates
 */
export async function getCsvTemplates(): Promise<ActionResult<CsvTemplate[]>> {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return createUnauthorizedResult();
    }

    const { data: templates, error } = await supabase
      .from('csv_templates')
      .select('*')
      .eq('is_active', true)
      .order('bank_name');

    if (error) {
      return handleSupabaseError(error);
    }

    return createSuccessResult((templates || []) as CsvTemplate[]);
  } catch (error) {
    return handleSupabaseError(error);
  }
}
