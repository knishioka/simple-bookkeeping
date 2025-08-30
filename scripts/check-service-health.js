#!/usr/bin/env node

/**
 * サービスのヘルスチェックスクリプト
 * Port 3000で動作しているWebサービスを確認
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http');
/* eslint-enable @typescript-eslint/no-require-imports */

const COLORS = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
};

async function checkWebService() {
  return new Promise((resolve) => {
    http
      .get('http://localhost:3000', (res) => {
        console.log(`Web (3000): ${COLORS.GREEN}✅ ${res.statusCode}${COLORS.RESET}`);
        resolve(true);
      })
      .on('error', () => {
        console.log(`Web (3000): ${COLORS.RED}❌ 停止中${COLORS.RESET}`);
        resolve(false);
      });
  });
}

async function main() {
  console.log(`${COLORS.BLUE}🏥 サービス状態チェック${COLORS.RESET}`);
  console.log('========================');

  const webOk = await checkWebService();

  console.log('========================');

  // 推奨アクション
  if (!webOk) {
    console.log(`${COLORS.YELLOW}💡 Webサービスを起動: pnpm --filter web dev${COLORS.RESET}`);
  }

  // 終了コード
  process.exit(webOk ? 0 : 1);
}

main().catch(console.error);
