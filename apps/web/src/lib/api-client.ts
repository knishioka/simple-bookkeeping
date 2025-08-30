import { toast } from 'react-hot-toast';

interface ApiConfig {
  baseUrl: string;
  headers?: Record<string, string>;
}

interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

interface UploadOptions {
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

class ApiClient {
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = config;
  }

  private getHeaders(contentType?: string | null): Headers {
    const headers = new Headers();

    // Only set Content-Type if not null (null means FormData will set it automatically)
    if (contentType !== null) {
      headers.set('Content-Type', contentType || 'application/json');
    }

    // Add custom headers
    if (this.config.headers) {
      Object.entries(this.config.headers).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }

    const token = this.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const orgId = this.getOrganizationId();
    if (orgId) {
      headers.set('X-Organization-Id', orgId);
    }

    return headers;
  }

  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  }

  private getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('refreshToken');
    }
    return null;
  }

  setToken(token: string, refreshToken: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  clearTokens(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
    }
  }

  private getOrganizationId(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('organizationId');
    }
    return null;
  }

  setOrganizationId(organizationId: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('organizationId', organizationId);
    }
  }

  clearOrganizationId(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('organizationId');
    }
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${path}`;
    const headers = this.getHeaders();

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        // Try to refresh token if unauthorized
        if (response.status === 401 && path !== '/auth/refresh') {
          const refreshed = await this.refreshToken();
          if (refreshed) {
            // Retry the original request
            return this.request<T>(path, options);
          }
        }

        if (data.error) {
          // Only show toast for non-organization errors
          if (data.error.code !== 'ORGANIZATION_REQUIRED' && data.error.code !== 'FORBIDDEN') {
            toast.error(data.error.message || 'エラーが発生しました');
          }
          return { error: data.error };
        }
      }

      // Check if response has a data wrapper
      if (data && typeof data === 'object' && 'data' in data) {
        return { data: data.data };
      }

      // Otherwise return the data directly
      return { data };
    } catch (error) {
      console.error('API request failed:', error);
      toast.error('通信エラーが発生しました');
      return {
        error: {
          code: 'NETWORK_ERROR',
          message: '通信エラーが発生しました',
        },
      };
    }
  }

  private async refreshToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    const response = await this.request<{
      token: string;
      refreshToken: string;
    }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (response.data) {
      this.setToken(response.data.token, response.data.refreshToken);
      return true;
    }

    this.clearTokens();
    window.location.href = '/login';
    return false;
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  async upload<T>(path: string, file: File, options?: UploadOptions): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${path}`;
    const headers = this.getHeaders(null); // null to let FormData set boundary

    const formData = new FormData();
    formData.append('file', file);

    try {
      const xhr = new XMLHttpRequest();

      return new Promise<ApiResponse<T>>((resolve) => {
        // Setup progress tracking
        if (options?.onProgress) {
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && options.onProgress) {
              const percentComplete = (event.loaded / event.total) * 100;
              options.onProgress(percentComplete);
            }
          });
        }

        // Setup abort signal
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            xhr.abort();
          });
        }

        // Setup response handler
        xhr.addEventListener('load', async () => {
          try {
            const data = JSON.parse(xhr.responseText);

            if (xhr.status >= 200 && xhr.status < 300) {
              // Check if response has a data wrapper
              if (data && typeof data === 'object' && 'data' in data) {
                resolve({ data: data.data });
              } else {
                resolve({ data });
              }
            } else {
              // Handle errors
              if (xhr.status === 401 && path !== '/auth/refresh') {
                const refreshed = await this.refreshToken();
                if (refreshed) {
                  // Retry the upload
                  return this.upload<T>(path, file, options);
                }
              }

              if (data.error) {
                if (
                  data.error.code !== 'ORGANIZATION_REQUIRED' &&
                  data.error.code !== 'FORBIDDEN'
                ) {
                  toast.error(data.error.message || 'エラーが発生しました');
                }
                resolve({ error: data.error });
              } else {
                resolve({
                  error: {
                    code: 'UPLOAD_FAILED',
                    message: 'ファイルのアップロードに失敗しました',
                  },
                });
              }
            }
          } catch (error) {
            console.error('Failed to parse response:', error);
            resolve({
              error: {
                code: 'PARSE_ERROR',
                message: 'レスポンスの解析に失敗しました',
              },
            });
          }
        });

        xhr.addEventListener('error', () => {
          console.error('Upload failed');
          toast.error('通信エラーが発生しました');
          resolve({
            error: {
              code: 'NETWORK_ERROR',
              message: '通信エラーが発生しました',
            },
          });
        });

        xhr.addEventListener('abort', () => {
          resolve({
            error: {
              code: 'UPLOAD_ABORTED',
              message: 'アップロードがキャンセルされました',
            },
          });
        });

        // Start the upload
        xhr.open('POST', url);

        // Set headers
        headers.forEach((value, key) => {
          xhr.setRequestHeader(key, value);
        });

        xhr.send(formData);
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('ファイルのアップロードに失敗しました');
      return {
        error: {
          code: 'UPLOAD_ERROR',
          message: 'ファイルのアップロードに失敗しました',
        },
      };
    }
  }

  async getBlob(endpoint: string): Promise<Blob> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = this.getHeaders('application/json');

    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'ダウンロードに失敗しました';

      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch {
        // If not JSON, use default message
      }

      throw new Error(errorMessage);
    }

    return response.blob();
  }

  // File validation utilities
  validateFile(
    file: File,
    options?: {
      maxSize?: number; // in bytes
      allowedTypes?: string[]; // mime types or extensions
    }
  ): { valid: boolean; error?: string } {
    const { maxSize = 10 * 1024 * 1024, allowedTypes = ['.csv', 'text/csv'] } = options || {};

    // Check file size
    if (file.size > maxSize) {
      const sizeMB = (maxSize / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `ファイルサイズは${sizeMB}MB以下にしてください`,
      };
    }

    // Check file type
    if (allowedTypes.length > 0) {
      const fileName = file.name.toLowerCase();
      const fileType = file.type.toLowerCase();

      const isValidType = allowedTypes.some((type) => {
        if (type.startsWith('.')) {
          // Check by extension
          return fileName.endsWith(type.toLowerCase());
        }
        // Check by MIME type
        return fileType === type.toLowerCase();
      });

      if (!isValidType) {
        return {
          valid: false,
          error: `許可されていないファイル形式です。対応形式: ${allowedTypes.join(', ')}`,
        };
      }
    }

    return { valid: true };
  }
}

// API routes are now in Next.js
const baseUrl = '/api';

export const apiClient = new ApiClient({
  baseUrl,
});

export default apiClient;
