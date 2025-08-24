#!/usr/bin/env node

/**
 * サービスのヘルスチェックスクリプト
 * Port 3001で動作しているサービスがSimple Bookkeeping APIか確認
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { exec } = require('child_process');
const http = require('http');
const util = require('util');
const execPromise = util.promisify(exec);
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

async function checkAPIService() {
  return new Promise((resolve) => {
    // まず /api/v1/health エンドポイントを確認
    http
      .get('http://localhost:3001/api/v1/health', (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          // レスポンスにokやhealthyが含まれるか確認
          if (
            res.statusCode === 200 &&
            (data.includes('ok') || data.includes('healthy') || data.includes('UP'))
          ) {
            console.log(`API (3001): ${COLORS.GREEN}✅ Simple Bookkeeping API${COLORS.RESET}`);
            resolve('simple-bookkeeping');
          } else {
            // 別のサービスが動作している可能性
            checkAlternativeService(resolve);
          }
        });
      })
      .on('error', () => {
        // ポート3001に接続できない
        checkPortUsage(resolve);
      });
  });
}

async function checkAlternativeService(resolve) {
  // ルートパスにアクセスしてみる
  http
    .get('http://localhost:3001/', (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        // Simple Bookkeepingの文字列を探す
        if (data.toLowerCase().includes('simple') && data.toLowerCase().includes('bookkeeping')) {
          console.log(
            `API (3001): ${COLORS.YELLOW}⚠️ APIサービスは動作中だがヘルスチェックに失敗${COLORS.RESET}`
          );
        } else {
          console.log(`API (3001): ${COLORS.YELLOW}⚠️ 別のサービスが動作中${COLORS.RESET}`);
        }
        resolve('other');
      });
    })
    .on('error', () => {
      console.log(`API (3001): ${COLORS.RED}❌ 停止中${COLORS.RESET}`);
      resolve(false);
    });
}

async function checkPortUsage(resolve) {
  try {
    // lsofでポート使用状況を確認
    const { stdout } = await execPromise('lsof -i :3001 2>/dev/null | grep LISTEN');
    if (stdout) {
      // プロセス名を取得
      const processName = stdout.split(/\s+/)[0];
      console.log(
        `API (3001): ${COLORS.YELLOW}⚠️ ポート使用中だが応答なし (${processName})${COLORS.RESET}`
      );
      resolve('no-response');
    } else {
      console.log(`API (3001): ${COLORS.RED}❌ 停止中${COLORS.RESET}`);
      resolve(false);
    }
  } catch {
    console.log(`API (3001): ${COLORS.RED}❌ 停止中${COLORS.RESET}`);
    resolve(false);
  }
}

async function checkProcessDetails() {
  try {
    const { stdout } = await execPromise('lsof -i :3001 -t 2>/dev/null | head -1');
    if (stdout) {
      const pid = stdout.trim();
      const { stdout: processInfo } = await execPromise(`ps -p ${pid} -o args= 2>/dev/null`);

      if (
        processInfo.includes('simple-bookkeeping') ||
        processInfo.includes('@simple-bookkeeping')
      ) {
        console.log(`${COLORS.BLUE}詳細: Simple Bookkeeping APIプロセス確認済み${COLORS.RESET}`);
      } else if (processInfo.includes('node') || processInfo.includes('tsx')) {
        console.log(`${COLORS.YELLOW}詳細: Node.jsプロセスが動作中${COLORS.RESET}`);
      } else {
        console.log(`${COLORS.YELLOW}詳細: 別のプロセスが動作中${COLORS.RESET}`);
      }
      console.log(
        `  コマンド: ${processInfo.substring(0, 80)}${processInfo.length > 80 ? '...' : ''}`
      );
    }
  } catch {
    // エラーは無視
  }
}

async function main() {
  console.log(`${COLORS.BLUE}🏥 サービス状態チェック${COLORS.RESET}`);
  console.log('========================');

  const webOk = await checkWebService();
  const apiStatus = await checkAPIService();

  // APIの詳細情報を表示
  if (apiStatus === 'other' || apiStatus === 'no-response') {
    await checkProcessDetails();
  }

  console.log('========================');

  // 推奨アクション
  if (!webOk) {
    console.log(`${COLORS.YELLOW}💡 Webサービスを起動: pnpm --filter web dev${COLORS.RESET}`);
  }
  if (apiStatus === false) {
    console.log(`${COLORS.YELLOW}💡 APIサービスを起動: pnpm --filter api dev${COLORS.RESET}`);
  } else if (apiStatus === 'other') {
    console.log(`${COLORS.YELLOW}💡 Port 3001で別のサービスが動作中です${COLORS.RESET}`);
    console.log(`${COLORS.YELLOW}   必要に応じて停止してからAPIを起動してください${COLORS.RESET}`);
  }

  // 終了コード
  process.exit(webOk && apiStatus === 'simple-bookkeeping' ? 0 : 1);
}

main().catch(console.error);
