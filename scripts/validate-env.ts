#!/usr/bin/env tsx
/**
 * 環境変数バリデーションスクリプト
 *
 * 使用方法:
 *   pnpm env:validate          # 全環境変数をチェック
 *   pnpm env:validate --api     # APIサーバーの環境変数のみチェック
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
const checkApi = args.includes('--api');
const checkWeb = args.includes('--web');
const strictMode = args.includes('--strict');
const checkAll = !checkApi && !checkWeb;

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
if (checkAll || checkApi) {
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

// APIサーバー設定のチェック
if (checkAll || checkApi) {
  log.header('APIサーバー設定');

  // JWT_SECRET
  if (!process.env.JWT_SECRET) {
    log.error('JWT_SECRETが設定されていません');
    hasError = true;
  } else if (process.env.JWT_SECRET.length < 32) {
    log.error('JWT_SECRETは最低32文字以上にしてください（セキュリティ）');
    hasError = true;
  } else if (process.env.JWT_SECRET === 'local-dev-secret-change-in-production') {
    if (process.env.NODE_ENV === 'production') {
      log.error('本番環境でデフォルトのJWT_SECRETを使用しています！');
      hasError = true;
    } else {
      log.warning(
        '開発環境でデフォルトのJWT_SECRETを使用しています（本番環境では変更してください）'
      );
      hasWarning = true;
    }
  }

  // JWT_REFRESH_SECRET
  if (!process.env.JWT_REFRESH_SECRET) {
    log.error('JWT_REFRESH_SECRETが設定されていません');
    hasError = true;
  } else if (process.env.JWT_REFRESH_SECRET.length < 32) {
    log.error('JWT_REFRESH_SECRETは最低32文字以上にしてください');
    hasError = true;
  } else if (process.env.JWT_REFRESH_SECRET === 'local-dev-refresh-secret-change-in-production') {
    if (process.env.NODE_ENV === 'production') {
      log.error('本番環境でデフォルトのJWT_REFRESH_SECRETを使用しています！');
      hasError = true;
    }
  }

  // CORS_ORIGIN (development環境ではオプション)
  if (!process.env.CORS_ORIGIN) {
    if (process.env.NODE_ENV === 'production') {
      log.error('本番環境ではCORS_ORIGINが必須です');
      hasError = true;
    } else {
      log.warning(
        'CORS_ORIGINが設定されていません（開発環境では localhost:3000 がデフォルトで使用されます）'
      );
      hasWarning = true;
    }
  }

  // API_PORT
  if (process.env.API_PORT) {
    const port = parseInt(process.env.API_PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      log.error('API_PORTは1-65535の範囲で指定してください');
      hasError = true;
    }
  }

  // NODE_ENV
  if (process.env.NODE_ENV) {
    if (!['development', 'production', 'test'].includes(process.env.NODE_ENV)) {
      log.warning(`NODE_ENVの値が不正です: ${process.env.NODE_ENV}`);
      hasWarning = true;
    }
  }

  if (!hasError) {
    log.success('APIサーバー設定: OK');
  }
}

// フロントエンド設定のチェック
if (checkAll || checkWeb) {
  log.header('フロントエンド設定');

  // NEXT_PUBLIC_API_URL
  if (!process.env.NEXT_PUBLIC_API_URL) {
    log.error('NEXT_PUBLIC_API_URLが設定されていません');
    hasError = true;
  } else {
    try {
      new URL(process.env.NEXT_PUBLIC_API_URL);
      if (!process.env.NEXT_PUBLIC_API_URL.endsWith('/api/v1')) {
        log.error(
          'NEXT_PUBLIC_API_URLは /api/v1 で終わる必要があります（例: http://localhost:3001/api/v1）'
        );
        hasError = true;
      } else {
        log.success('フロントエンド設定: OK');
      }
    } catch {
      log.error('NEXT_PUBLIC_API_URLが有効なURLではありません');
      hasError = true;
    }
  }

  // NEXT_PUBLIC_APP_URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      new URL(process.env.NEXT_PUBLIC_APP_URL);
    } catch {
      log.warning('NEXT_PUBLIC_APP_URLが有効なURLではありません');
      hasWarning = true;
    }
  }

  // API URLの一貫性チェック
  if (process.env.CORS_ORIGIN && process.env.NEXT_PUBLIC_APP_URL) {
    const corsOrigins = process.env.CORS_ORIGIN.split(',').map((o) => o.trim());
    if (!corsOrigins.includes(process.env.NEXT_PUBLIC_APP_URL)) {
      log.warning(
        `NEXT_PUBLIC_APP_URL (${process.env.NEXT_PUBLIC_APP_URL}) がCORS_ORIGINに含まれていません`
      );
      hasWarning = true;
    }
  }
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
