import { getServerTime, fetchDataAction } from '@/app/actions/example';

import TestForm from './test-form';

// サーバーコンポーネントでServer Actionを直接呼び出し
export default async function TestServerActionsPage() {
  // サーバー側で実行
  const serverInfo = await getServerTime();
  const initialData = await fetchDataAction();

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Server Actions テストページ</h1>

      <div className="space-y-6">
        {/* サーバー側で取得したデータを表示 */}
        <section className="border p-4 rounded">
          <h2 className="text-xl font-semibold mb-2">サーバー情報</h2>
          <p>サーバー時刻: {serverInfo.time}</p>
          <p>メッセージ: {serverInfo.message}</p>
        </section>

        {/* 初期データ表示 */}
        <section className="border p-4 rounded">
          <h2 className="text-xl font-semibold mb-2">初期データ</h2>
          <p className="text-sm text-gray-600 mb-2">取得時刻: {initialData.fetchedAt}</p>
          <ul className="list-disc list-inside">
            {initialData.data.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        </section>

        {/* クライアントコンポーネント（フォーム） */}
        <TestForm />
      </div>
    </div>
  );
}
