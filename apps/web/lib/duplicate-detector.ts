import type { ParsedCsvRow } from '@/types/csv-import';

import { createServiceClient } from '@/lib/supabase/server';

/**
 * Detect potential duplicate journal entries
 */
export async function detectDuplicates(
  organizationId: string,
  rows: ParsedCsvRow[]
): Promise<Map<number, DuplicateInfo>> {
  const duplicates = new Map<number, DuplicateInfo>();

  if (rows.length === 0) {
    return duplicates;
  }

  try {
    const supabase = createServiceClient();

    // Get date range for query optimization
    const dates = rows.map((r) => r.date);
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Add 1 day buffer for date matching
    minDate.setDate(minDate.getDate() - 1);
    maxDate.setDate(maxDate.getDate() + 1);

    // Fetch existing journal entries in date range
    const { data: existingEntries, error } = await supabase
      .from('journal_entries')
      .select('id, date, description, amount, created_at')
      .eq('organization_id', organizationId)
      .gte('date', minDate.toISOString())
      .lte('date', maxDate.toISOString())
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching existing entries:', error);
      return duplicates;
    }

    // Check each row for duplicates
    rows.forEach((row, index) => {
      const duplicate = findDuplicate(row, existingEntries || []);
      if (duplicate) {
        duplicates.set(index, duplicate);
      }
    });

    // Also check for duplicates within the import itself
    rows.forEach((row1, index1) => {
      rows.forEach((row2, index2) => {
        if (index1 < index2 && !duplicates.has(index2)) {
          if (areSimilarTransactions(row1, row2)) {
            duplicates.set(index2, {
              isDuplicate: true,
              confidence: 0.9,
              duplicateType: 'within-import',
              duplicateRowIndex: index1,
            });
          }
        }
      });
    });

    return duplicates;
  } catch (error) {
    console.error('Error in duplicate detection:', error);
    return duplicates;
  }
}

/**
 * Find duplicate entry in existing journal entries
 */
function findDuplicate(
  row: ParsedCsvRow,
  existingEntries: Array<{
    id: string;
    date: string;
    description: string | null;
    amount: number;
    created_at: string;
  }>
): DuplicateInfo | null {
  for (const entry of existingEntries) {
    const entryDate = new Date(entry.date);
    const daysDiff = Math.abs((row.date.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));

    // Check if dates are within 1 day of each other
    if (daysDiff <= 1) {
      // Check amount (exact match or very close)
      const amountMatch = Math.abs(entry.amount - row.amount) < 0.01;

      if (amountMatch) {
        // Check description similarity
        const descSimilarity = calculateSimilarity(
          row.description.toLowerCase(),
          (entry.description || '').toLowerCase()
        );

        if (descSimilarity > 0.7) {
          return {
            isDuplicate: true,
            confidence: descSimilarity,
            duplicateType: 'existing',
            journalEntryId: entry.id,
            duplicateDetails: {
              date: entryDate,
              amount: entry.amount,
              description: entry.description || '',
            },
          };
        }
      }
    }
  }

  return null;
}

/**
 * Check if two transactions are similar
 */
function areSimilarTransactions(row1: ParsedCsvRow, row2: ParsedCsvRow): boolean {
  // Same date
  const sameDate =
    row1.date.getFullYear() === row2.date.getFullYear() &&
    row1.date.getMonth() === row2.date.getMonth() &&
    row1.date.getDate() === row2.date.getDate();

  // Same amount
  const sameAmount = Math.abs(row1.amount - row2.amount) < 0.01;

  // Similar description
  const similarDesc =
    calculateSimilarity(row1.description.toLowerCase(), row2.description.toLowerCase()) > 0.9;

  return sameDate && sameAmount && similarDesc;
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;

  // Use simpler similarity check for performance
  // Check if one string contains the other
  if (str1.includes(str2) || str2.includes(str1)) {
    return 0.8;
  }

  // Check common words
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  const commonWords = words1.filter((w) => words2.includes(w));
  const similarity = commonWords.length / Math.max(words1.length, words2.length);

  return similarity;
}

/**
 * Get suggested action for duplicates
 */
export function getDuplicateAction(duplicate: DuplicateInfo): DuplicateAction {
  if (duplicate.confidence >= 0.95) {
    return 'skip';
  } else if (duplicate.confidence >= 0.8) {
    return 'review';
  } else {
    return 'import';
  }
}

// Types
export interface DuplicateInfo {
  isDuplicate: boolean;
  confidence: number;
  duplicateType: 'existing' | 'within-import';
  journalEntryId?: string;
  duplicateRowIndex?: number;
  duplicateDetails?: {
    date: Date;
    amount: number;
    description: string;
  };
}

export type DuplicateAction = 'skip' | 'review' | 'import';

/**
 * Filter out duplicate rows based on user preferences
 */
export function filterDuplicates(
  rows: ParsedCsvRow[],
  duplicates: Map<number, DuplicateInfo>,
  skipHighConfidence: boolean = true
): ParsedCsvRow[] {
  return rows.filter((_row, index) => {
    const duplicate = duplicates.get(index);
    if (!duplicate) {
      return true;
    }

    if (skipHighConfidence && duplicate.confidence >= 0.95) {
      return false;
    }

    return true;
  });
}
