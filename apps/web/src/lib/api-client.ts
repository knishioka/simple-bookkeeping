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

class ApiClient {
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = config;
  }

  private getHeaders(): Headers {
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...this.config.headers,
    });

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
          toast.error(data.error.message || 'エラーが発生しました');
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
}

// Use environment variable for API URL, fallback to localhost for development
const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const apiClient = new ApiClient({
  baseUrl,
});

export default apiClient;
