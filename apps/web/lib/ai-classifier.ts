import type { Database } from '@/lib/supabase/database.types';
import type { AccountSuggestion, ImportRule } from '@/types/csv-import';

type Account = Database['public']['Tables']['accounts']['Row'];

/**
 * AI-based account classification using OpenAI API (optional)
 */
export async function classifyWithAI(
  description: string,
  accounts: Account[],
  apiKey?: string
): Promise<AccountSuggestion | null> {
  if (!apiKey || !process.env.OPENAI_API_KEY) {
    return null;
  }

  try {
    const accountList = accounts.map((acc) => `${acc.code} - ${acc.name}`).join('\n');

    const prompt = `Given the following transaction description, suggest the most appropriate debit and credit accounts from the list below.

Transaction Description: "${description}"

Available Accounts:
${accountList}

Please respond in JSON format with the following structure:
{
  "debitAccount": "account code",
  "creditAccount": "account code",
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}

Common patterns for Japanese accounting:
- Income: Debit = Cash/Bank (普通預金), Credit = Revenue (売上高)
- Expense: Debit = Expense account, Credit = Cash/Bank (普通預金)
- Transfer: Between bank/cash accounts`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey || process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an accounting expert specializing in Japanese bookkeeping standards.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.statusText);
      return null;
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    // Find account IDs from codes
    const debitAccount = accounts.find((acc) => acc.code === result.debitAccount);
    const creditAccount = accounts.find((acc) => acc.code === result.creditAccount);

    if (!debitAccount || !creditAccount) {
      return null;
    }

    return {
      accountId: debitAccount.id,
      contraAccountId: creditAccount.id,
      confidence: result.confidence || 0.5,
      reason: result.reason,
    };
  } catch (error) {
    console.error('AI classification error:', error);
    return null;
  }
}

/**
 * Rule-based account classification (fallback when AI is not available)
 */
export function classifyWithRules(
  description: string,
  _amount: number,
  type: 'income' | 'expense' | undefined,
  rules: ImportRule[],
  accounts: Account[]
): AccountSuggestion | null {
  // Check if any rule matches
  const matchingRule = findMatchingRule(description, rules);
  if (matchingRule) {
    return {
      accountId: matchingRule.account_id,
      contraAccountId: matchingRule.contra_account_id,
      confidence: matchingRule.confidence || 0.8,
      ruleId: matchingRule.id,
      reason: 'Matched import rule',
    };
  }

  // Use default patterns based on common keywords
  const suggestion = suggestByKeywords(description, type, accounts);
  if (suggestion) {
    return suggestion;
  }

  // Return default suggestion based on transaction type
  return getDefaultSuggestion(type, accounts);
}

/**
 * Find matching import rule
 */
function findMatchingRule(description: string, rules: ImportRule[]): ImportRule | null {
  const descLower = description.toLowerCase();

  for (const rule of rules) {
    if (!rule.is_active) continue;

    const pattern = rule.description_pattern.toLowerCase();

    // Check if pattern is a regex
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
      try {
        // eslint-disable-next-line security/detect-non-literal-regexp -- Pattern comes from database rules created by users
        const regex = new RegExp(pattern.slice(1, -1), 'i');
        if (regex.test(description)) {
          return rule;
        }
      } catch {
        // If regex is invalid, treat as keyword
        if (descLower.includes(pattern)) {
          return rule;
        }
      }
    } else {
      // Simple keyword matching
      if (descLower.includes(pattern)) {
        return rule;
      }
    }
  }

  return null;
}

/**
 * Suggest accounts based on keywords
 */
function suggestByKeywords(
  description: string,
  type: 'income' | 'expense' | undefined,
  accounts: Account[]
): AccountSuggestion | null {
  const descLower = description.toLowerCase();

  // Find default bank account
  const bankAccount = accounts.find((acc) => acc.code === '1110' || acc.name.includes('普通預金'));

  if (!bankAccount) {
    return null;
  }

  // Income patterns
  if (type === 'income' || descLower.includes('入金') || descLower.includes('振込')) {
    const revenueAccount = accounts.find((acc) => acc.code === '4110' || acc.name.includes('売上'));

    if (revenueAccount) {
      return {
        accountId: bankAccount.id, // Debit
        contraAccountId: revenueAccount.id, // Credit
        confidence: 0.6,
        reason: 'Income pattern detected',
      };
    }
  }

  // Expense patterns
  if (type === 'expense') {
    // Utility expenses
    if (descLower.includes('電気') || descLower.includes('ガス') || descLower.includes('水道')) {
      const utilityAccount = accounts.find(
        (acc) => acc.code === '7130' || acc.name.includes('水道光熱費')
      );

      if (utilityAccount) {
        return {
          accountId: utilityAccount.id, // Debit
          contraAccountId: bankAccount.id, // Credit
          confidence: 0.7,
          reason: 'Utility expense pattern',
        };
      }
    }

    // Communication expenses
    if (
      descLower.includes('電話') ||
      descLower.includes('携帯') ||
      descLower.includes('インターネット')
    ) {
      const commAccount = accounts.find(
        (acc) => acc.code === '7140' || acc.name.includes('通信費')
      );

      if (commAccount) {
        return {
          accountId: commAccount.id, // Debit
          contraAccountId: bankAccount.id, // Credit
          confidence: 0.7,
          reason: 'Communication expense pattern',
        };
      }
    }

    // Travel expenses
    if (descLower.includes('jr') || descLower.includes('電車') || descLower.includes('交通')) {
      const travelAccount = accounts.find(
        (acc) => acc.code === '7110' || acc.name.includes('旅費交通費')
      );

      if (travelAccount) {
        return {
          accountId: travelAccount.id, // Debit
          contraAccountId: bankAccount.id, // Credit
          confidence: 0.7,
          reason: 'Travel expense pattern',
        };
      }
    }
  }

  return null;
}

/**
 * Get default suggestion based on transaction type
 */
function getDefaultSuggestion(
  type: 'income' | 'expense' | undefined,
  accounts: Account[]
): AccountSuggestion | null {
  // Find default accounts
  const bankAccount = accounts.find((acc) => acc.code === '1110' || acc.name.includes('普通預金'));

  if (!bankAccount) {
    return null;
  }

  if (type === 'income') {
    const revenueAccount = accounts.find((acc) => acc.code === '4110' || acc.name.includes('売上'));

    if (revenueAccount) {
      return {
        accountId: bankAccount.id, // Debit
        contraAccountId: revenueAccount.id, // Credit
        confidence: 0.3,
        reason: 'Default income mapping',
      };
    }
  } else if (type === 'expense') {
    const expenseAccount = accounts.find(
      (acc) => acc.code === '7190' || acc.name.includes('その他経費')
    );

    if (expenseAccount) {
      return {
        accountId: expenseAccount.id, // Debit
        contraAccountId: bankAccount.id, // Credit
        confidence: 0.3,
        reason: 'Default expense mapping',
      };
    }
  }

  return null;
}

/**
 * Combine AI and rule-based classification
 */
export async function classifyTransaction(
  description: string,
  amount: number,
  type: 'income' | 'expense' | undefined,
  rules: ImportRule[],
  accounts: Account[],
  useAI: boolean = false
): Promise<AccountSuggestion | null> {
  // Try AI classification first if enabled
  if (useAI && process.env.OPENAI_API_KEY) {
    const aiSuggestion = await classifyWithAI(description, accounts);
    if (aiSuggestion && aiSuggestion.confidence >= 0.7) {
      return aiSuggestion;
    }
  }

  // Fall back to rule-based classification
  return classifyWithRules(description, amount, type, rules, accounts);
}
