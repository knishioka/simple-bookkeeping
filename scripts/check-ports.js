#!/usr/bin/env node

const net = require('net');

// ポート設定
const ports = [
  { name: 'Web (Next.js)', port: process.env.WEB_PORT || 3000 },
  { name: 'API (Express)', port: process.env.API_PORT || 3001 },
];

// ポートが利用可能かチェック
async function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// 全ポートをチェック
async function checkAllPorts() {
  console.log('🔍 ポート利用状況をチェック中...\n');

  let hasConflict = false;

  for (const { name, port } of ports) {
    const available = await checkPort(port);
    if (available) {
      console.log(`✅ ${name}: ポート ${port} は利用可能です`);
    } else {
      console.log(`❌ ${name}: ポート ${port} は既に使用中です`);
      hasConflict = true;
    }
  }

  if (hasConflict) {
    console.log('\n⚠️  ポートの競合が検出されました');
    console.log('解決方法:');
    console.log('1. .envファイルでポート番号を変更してください');
    console.log('   例: WEB_PORT=3010');
    console.log('2. または、使用中のプロセスを停止してください');
    console.log('   lsof -i :ポート番号 で確認できます');
  } else {
    console.log('\n✨ すべてのポートが利用可能です');
  }
}

// 実行
checkAllPorts().catch(console.error);
