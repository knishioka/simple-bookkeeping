import type { SupabaseClient } from './client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { createClient } from './client';

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimeSubscription {
  channel: RealtimeChannel;
  unsubscribe: () => void;
}

/**
 * Supabase Realtimeサービス
 * リアルタイム更新の購読と管理
 */
export class RealtimeService {
  private supabase: SupabaseClient;
  private channels: Map<string, RealtimeChannel> = new Map();

  constructor() {
    this.supabase = createClient();
  }

  /**
   * データベーステーブルの変更を購読
   */
  subscribeToTable<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    callback: (payload: RealtimePostgresChangesPayload<T>) => void,
    options?: {
      event?: RealtimeEvent;
      filter?: string;
      schema?: string;
    }
  ): RealtimeSubscription {
    const channelName = `table-${table}-${Date.now()}`;

    const channel = this.supabase
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: options?.event || '*',
          schema: options?.schema || 'public',
          table,
          filter: options?.filter,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback as any
      )
      .subscribe();

    this.channels.set(channelName, channel);

    return {
      channel,
      unsubscribe: () => this.unsubscribe(channelName),
    };
  }

  /**
   * 仕訳入力のリアルタイム更新を購読
   */
  subscribeToJournalEntries(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback: (payload: RealtimePostgresChangesPayload<Record<string, any>>) => void,
    organizationId?: string
  ): RealtimeSubscription {
    const filter = organizationId ? `organization_id=eq.${organizationId}` : undefined;

    return this.subscribeToTable('journal_entries', callback, { filter });
  }

  /**
   * 勘定科目のリアルタイム更新を購読
   */
  subscribeToAccounts(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback: (payload: RealtimePostgresChangesPayload<Record<string, any>>) => void,
    organizationId?: string
  ): RealtimeSubscription {
    const filter = organizationId ? `organization_id=eq.${organizationId}` : undefined;

    return this.subscribeToTable('accounts', callback, { filter });
  }

  /**
   * オンラインユーザーのプレゼンス管理
   */
  setupPresence(channelName: string, userInfo: { id: string; name: string; email: string }) {
    const channel = this.supabase.channel(channelName);

    // 自分のプレゼンス情報を送信
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        console.warn('Online users:', state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.warn('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.warn('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user: userInfo,
            online_at: new Date().toISOString(),
          });
        }
      });

    this.channels.set(channelName, channel);

    return {
      channel,
      unsubscribe: () => this.unsubscribe(channelName),
    };
  }

  /**
   * ブロードキャストメッセージの送受信
   */
  setupBroadcast(channelName: string, onMessage: (message: unknown) => void) {
    const channel = this.supabase
      .channel(channelName)
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        onMessage(payload);
      })
      .subscribe();

    this.channels.set(channelName, channel);

    return {
      channel,
      send: (message: unknown) => {
        channel.send({
          type: 'broadcast',
          event: 'message',
          payload: message,
        });
      },
      unsubscribe: () => this.unsubscribe(channelName),
    };
  }

  /**
   * カスタムチャンネルの作成
   */
  createChannel(name: string): RealtimeChannel {
    const channel = this.supabase.channel(name);
    this.channels.set(name, channel);
    return channel;
  }

  /**
   * チャンネルから購読解除
   */
  unsubscribe(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      this.supabase.removeChannel(channel);
      this.channels.delete(channelName);
    }
  }

  /**
   * すべてのチャンネルから購読解除
   */
  unsubscribeAll(): void {
    this.channels.forEach((channel) => {
      this.supabase.removeChannel(channel);
    });
    this.channels.clear();
  }

  /**
   * 接続状態の監視
   */
  onConnectionStateChange(
    _callback: (state: 'connecting' | 'open' | 'closing' | 'closed') => void
  ) {
    // Supabase v2では、各チャンネルごとに状態を監視
    // グローバルな接続状態は現在サポートされていないため、
    // 個別のチャンネルで監視する必要があります
    console.warn('Connection state monitoring should be done per channel');
  }
}

// シングルトンインスタンス
export const realtimeService = new RealtimeService();
