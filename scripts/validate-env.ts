#!/usr/bin/env tsx
/**
 * 環境変数バリデーションスクリプト
 *
 * 使用方法:
 *   pnpm env:validate          # 全環境変数をチェック
 *   pnpm env:validate --web     # フロントエンドの環境変数のみチェック
 *   pnpm env:validate --strict  # 警告もエラーとして扱う
 */

import * as fs from 'fs';
import * as path from 'path';

// カラー出力用のヘルパー
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m',
};

const log = {
  error: (msg: string) => console.error(`${colors.red}❌ ${msg}${colors.reset}`),
  success: (msg: string) => console.error(`${colors.green}✅ ${msg}${colors.reset}`), // Use console.error to be consistent with linting rules
  warning: (msg: string) => console.error(`${colors.yellow}⚠️  ${msg}${colors.reset}`), // Use console.error to be consistent with linting rules
  info: (msg: string) => console.error(`${colors.blue}ℹ️  ${msg}${colors.reset}`), // Use console.error to be consistent with linting rules
  header: (msg: string) => console.error(`\n${colors.bold}${colors.blue}${msg}${colors.reset}`), // Use console.error to be consistent with linting rules
};

// コマンドライン引数の解析
const args = process.argv.slice(2);
const checkWeb = args.includes('--web');
const strictMode = args.includes('--strict');
const checkAll = !checkWeb;

// 環境変数ファイルの読み込み
const rootDir = path.join(__dirname, '..');
const envFiles = ['.env', '.env.local', `.env.${process.env.NODE_ENV || 'development'}`];

// 環境変数を読み込む
// Note: dotenvは不要（process.envは既に利用可能）
envFiles.forEach((file) => {
  const filePath = path.join(rootDir, file);
  if (fs.existsSync(filePath)) {
    // 環境変数ファイルを直接読み込んで解析
    const envConfig = fs.readFileSync(filePath, 'utf8');
    envConfig.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
    log.info(`読み込み: ${file}`);
  }
});

// バリデーション実行
let hasError = false;
let hasWarning = false;

log.header('環境変数バリデーション開始');

// データベース設定のチェック
if (checkAll) {
  log.header('データベース設定');

  if (!process.env.DATABASE_URL) {
    log.error('DATABASE_URLが設定されていません');
    hasError = true;
  } else if (!process.env.DATABASE_URL.startsWith('postgresql://')) {
    log.error('DATABASE_URLはpostgresql://で始まる必要があります');
    hasError = true;
  } else {
    log.success('データベース設定: OK');
  }
}

// NODE_ENV
if (checkAll) {
  if (process.env.NODE_ENV) {
    if (!['development', 'production', 'test'].includes(process.env.NODE_ENV)) {
      log.warning(`NODE_ENVの値が不正です: ${process.env.NODE_ENV}`);
      hasWarning = true;
    }
  }
}

// フロントエンド設定のチェック
if (checkAll || checkWeb) {
  log.header('フロントエンド設定');

  // NEXT_PUBLIC_APP_URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      new URL(process.env.NEXT_PUBLIC_APP_URL);
    } catch {
      log.warning('NEXT_PUBLIC_APP_URLが有効なURLではありません');
      hasWarning = true;
    }
  }

  log.success('フロントエンド設定: OK');
}

// オプション設定のチェック
if (checkAll) {
  log.header('オプション設定');

  // REDIS_URL
  if (process.env.REDIS_URL) {
    if (!process.env.REDIS_URL.startsWith('redis://')) {
      log.warning('REDIS_URLはredis://で始まる必要があります');
      hasWarning = true;
    }
  }

  if (!hasWarning) {
    log.success('オプション設定: OK');
  }
}

// 結果の表示
log.header('バリデーション結果');

if (!hasError && !hasWarning) {
  log.success('すべての環境変数が正しく設定されています！');
  process.exit(0);
} else if (hasError) {
  log.error('環境変数にエラーがあります。修正してください。');
  process.exit(1);
} else if (hasWarning && strictMode) {
  log.error('警告が見つかりました（strictモード）');
  process.exit(1);
} else {
  log.warning('警告が見つかりましたが、続行可能です。');
  process.exit(0);
}
