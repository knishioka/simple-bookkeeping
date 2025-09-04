'use server';

import { revalidatePath } from 'next/cache';

// シンプルなServer Actionの例
export async function getServerTime() {
  // サーバー側で実行される
  const serverTime = new Date().toISOString();

  return {
    time: serverTime,
    message: 'This was executed on the server!',
  };
}

// フォームデータを処理するServer Action
export async function testFormAction(formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;

  // サーバー側での処理
  // Form submitted with name and email

  // データベース処理など（今回は例のみ）
  const result = {
    success: true,
    data: {
      name,
      email,
      timestamp: new Date().toISOString(),
    },
  };

  // キャッシュの再検証
  revalidatePath('/test');

  return result;
}

// 非同期処理を含むServer Action
export async function fetchDataAction() {
  // 実際のデータベースアクセスやAPIコールをシミュレート
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return {
    data: [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' },
    ],
    fetchedAt: new Date().toISOString(),
  };
}
