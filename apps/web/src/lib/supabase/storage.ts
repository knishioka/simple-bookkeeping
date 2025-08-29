import { createClient } from './client';

import type { SupabaseClient } from './client';

/**
 * Supabase Storageサービス
 * ファイルアップロード、ダウンロード、削除などの機能を提供
 */
export class StorageService {
  private supabase: SupabaseClient;
  private bucketName: string;

  constructor(bucketName: 'receipts' | 'reports' | 'attachments') {
    this.supabase = createClient();
    this.bucketName = bucketName;
  }

  /**
   * ファイルアップロード
   * @param file - アップロードするファイル
   * @param path - 保存先パス（例: 'receipts/2024/01/receipt-001.pdf'）
   * @returns アップロードしたファイルのパス
   */
  async upload(file: File, path?: string): Promise<{ path: string; url: string }> {
    const fileName = path || this.generateFilePath(file);

    // ファイルバリデーション
    this.validateFile(file);

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new Error(`ファイルアップロードに失敗しました: ${error.message}`);
    }

    // 公開URLを取得
    const { data: urlData } = this.supabase.storage.from(this.bucketName).getPublicUrl(fileName);

    return {
      path: data.path,
      url: urlData.publicUrl,
    };
  }

  /**
   * ファイルダウンロード
   * @param path - ダウンロードするファイルのパス
   * @returns ファイルのBlob
   */
  async download(path: string): Promise<Blob> {
    const { data, error } = await this.supabase.storage.from(this.bucketName).download(path);

    if (error) {
      throw new Error(`ファイルダウンロードに失敗しました: ${error.message}`);
    }

    return data;
  }

  /**
   * ファイル削除
   * @param paths - 削除するファイルのパス（複数可）
   */
  async delete(paths: string | string[]): Promise<void> {
    const pathArray = Array.isArray(paths) ? paths : [paths];

    const { error } = await this.supabase.storage.from(this.bucketName).remove(pathArray);

    if (error) {
      throw new Error(`ファイル削除に失敗しました: ${error.message}`);
    }
  }

  /**
   * ファイル一覧取得
   * @param folder - フォルダパス
   * @param options - 検索オプション
   */
  async list(
    folder: string,
    options?: {
      limit?: number;
      offset?: number;
      sortBy?: { column: string; order: 'asc' | 'desc' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }
  ): Promise<any[]> {
    const { data, error } = await this.supabase.storage.from(this.bucketName).list(folder, {
      limit: options?.limit || 100,
      offset: options?.offset || 0,
      sortBy: options?.sortBy,
    });

    if (error) {
      throw new Error(`ファイル一覧の取得に失敗しました: ${error.message}`);
    }

    return data;
  }

  /**
   * 署名付きURL生成（プライベートファイル用）
   * @param path - ファイルパス
   * @param expiresIn - 有効期限（秒）
   */
  async createSignedUrl(path: string, expiresIn = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw new Error(`署名付きURL生成に失敗しました: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * ファイルパス生成
   * @param file - ファイル
   * @returns 生成されたファイルパス
   */
  private generateFilePath(file: File): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = now.getTime();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');

    return `${year}/${month}/${timestamp}_${safeName}`;
  }

  /**
   * ファイルバリデーション
   * @param file - 検証するファイル
   */
  private validateFile(file: File): void {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_TYPES = {
      receipts: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
      reports: [
        'application/pdf',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      attachments: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'text/plain',
        'text/csv',
      ],
    };

    // ファイルサイズチェック
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`ファイルサイズは${MAX_FILE_SIZE / 1024 / 1024}MB以下にしてください`);
    }

    // ファイルタイプチェック
    const allowedTypes = ALLOWED_TYPES[this.bucketName as keyof typeof ALLOWED_TYPES];
    if (allowedTypes && !allowedTypes.includes(file.type)) {
      throw new Error(`このファイルタイプはアップロードできません: ${file.type}`);
    }
  }

  /**
   * サムネイル生成（画像ファイル用）
   * @param file - 画像ファイル
   * @param maxWidth - 最大幅
   * @param maxHeight - 最大高さ
   */
  static async generateThumbnail(file: File, maxWidth = 200, maxHeight = 200): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('画像ファイルではありません'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Canvas contextの取得に失敗しました'));
            return;
          }

          // アスペクト比を保持したサイズ計算
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('サムネイル生成に失敗しました'));
              }
            },
            'image/jpeg',
            0.8
          );
        };
        img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
      reader.readAsDataURL(file);
    });
  }
}

// 便利なエクスポート
export const receiptStorage = new StorageService('receipts');
export const reportStorage = new StorageService('reports');
export const attachmentStorage = new StorageService('attachments');
