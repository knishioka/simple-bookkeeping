'use client';

import type { RealtimeSubscription, RealtimeEvent } from '@/lib/supabase/realtime';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { useEffect, useRef } from 'react';

import { realtimeService } from '@/lib/supabase/realtime';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface UseRealtimeOptions<T extends Record<string, any> = Record<string, any>> {
  table: string;
  event?: RealtimeEvent;
  filter?: string;
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: { old: T; new: T }) => void;
  onDelete?: (payload: T) => void;
  onChange?: (payload: RealtimePostgresChangesPayload<T>) => void;
  enabled?: boolean;
}

/**
 * Supabase Realtimeを使用するためのカスタムフック
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useRealtime<T extends Record<string, any> = Record<string, any>>({
  table,
  event = '*',
  filter,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
  enabled = true,
}: UseRealtimeOptions<T>) {
  const subscriptionRef = useRef<RealtimeSubscription | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // コールバック関数
    const handleChange = (payload: RealtimePostgresChangesPayload<T>) => {
      // 共通のonChangeコールバック
      onChange?.(payload);

      // イベント別のコールバック
      switch (payload.eventType) {
        case 'INSERT':
          onInsert?.(payload.new as T);
          break;
        case 'UPDATE':
          onUpdate?.({
            old: payload.old as T,
            new: payload.new as T,
          });
          break;
        case 'DELETE':
          onDelete?.(payload.old as T);
          break;
      }
    };

    // 購読開始
    subscriptionRef.current = realtimeService.subscribeToTable<T>(table, handleChange, {
      event,
      filter,
    });

    // クリーンアップ
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [table, event, filter, enabled, onInsert, onUpdate, onDelete, onChange]);

  return {
    isSubscribed: !!subscriptionRef.current,
  };
}

/**
 * オンラインユーザーのプレゼンスを管理するフック
 */
export function usePresence(
  channelName: string,
  userInfo: { id: string; name: string; email: string },
  enabled = true
) {
  const subscriptionRef = useRef<ReturnType<typeof realtimeService.setupPresence> | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    subscriptionRef.current = realtimeService.setupPresence(channelName, userInfo);

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [channelName, userInfo, enabled]);

  return {
    isConnected: !!subscriptionRef.current,
  };
}

/**
 * ブロードキャストメッセージを送受信するフック
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useBroadcast<T = any>(
  channelName: string,
  onMessage: (message: T) => void,
  enabled = true
) {
  const broadcastRef = useRef<ReturnType<typeof realtimeService.setupBroadcast> | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    broadcastRef.current = realtimeService.setupBroadcast(channelName, (message: unknown) => {
      onMessage(message as T);
    });

    return () => {
      if (broadcastRef.current) {
        broadcastRef.current.unsubscribe();
        broadcastRef.current = null;
      }
    };
  }, [channelName, enabled, onMessage]);

  const sendMessage = (message: T) => {
    if (broadcastRef.current) {
      broadcastRef.current.send(message);
    }
  };

  return {
    sendMessage,
    isConnected: !!broadcastRef.current,
  };
}
