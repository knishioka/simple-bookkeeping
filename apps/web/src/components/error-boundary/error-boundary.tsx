'use client';

import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import React, { Component, ErrorInfo, ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to monitoring service
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error details
    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      this.logErrorToService(error, errorInfo);
    }
  }

  logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    };

    // Production error tracking service integration
    // When SENTRY_DSN is configured, errors will be sent to Sentry
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
      // Note: Actual Sentry integration requires:
      // 1. Installing @sentry/nextjs package
      // 2. Configuring sentry.client.config.js
      // 3. Setting NEXT_PUBLIC_SENTRY_DSN environment variable
      // 4. Initializing Sentry in _app.tsx or layout.tsx

      // Example implementation (requires Sentry setup):
      // import * as Sentry from '@sentry/nextjs';
      // Sentry.captureException(error, {
      //   contexts: {
      //     react: {
      //       componentStack: errorInfo.componentStack,
      //     },
      //   },
      //   extra: errorData,
      // });

      // For now, log to console as fallback
      console.error('[Production Error]:', errorData);
    } else {
      // In development, log to console
      // eslint-disable-next-line no-console
      console.log('Error logged to service:', errorData);
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-6 w-6 text-red-500" />
                <CardTitle>エラーが発生しました</CardTitle>
              </div>
              <CardDescription>
                申し訳ございません。予期しないエラーが発生しました。
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>エラー詳細</AlertTitle>
                <AlertDescription className="mt-2">
                  <p className="font-mono text-sm">{this.state.error?.message || '不明なエラー'}</p>
                  {process.env.NODE_ENV === 'development' && this.state.error?.stack && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm">
                        スタックトレース（開発環境のみ）
                      </summary>
                      <pre className="mt-2 text-xs overflow-auto max-h-48 p-2 bg-gray-100 rounded">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                </AlertDescription>
              </Alert>

              {this.state.errorCount > 2 && (
                <Alert className="mt-4">
                  <AlertDescription>
                    エラーが繰り返し発生しています。ブラウザのキャッシュをクリアするか、
                    別のブラウザでお試しください。
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>

            <CardFooter className="flex flex-col space-y-2">
              <Button onClick={this.handleReset} className="w-full" variant="default">
                <RefreshCw className="mr-2 h-4 w-4" />
                もう一度試す
              </Button>
              <Button onClick={this.handleReload} variant="outline" className="w-full">
                ページを再読み込み
              </Button>
              <Button onClick={this.handleGoHome} variant="ghost" className="w-full">
                <Home className="mr-2 h-4 w-4" />
                ホームに戻る
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Async Error Boundary for handling async errors
export const AsyncErrorBoundary = ({ children, ...props }: Props) => {
  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      // You could trigger error boundary here if needed
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return <ErrorBoundary {...props}>{children}</ErrorBoundary>;
};
