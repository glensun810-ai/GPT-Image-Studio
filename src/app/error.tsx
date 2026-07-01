'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">页面出错了</h2>
          <p className="text-sm text-muted-foreground/70">
            抱歉，应用发生了意外错误。请尝试刷新页面。
          </p>
        </div>
        <Button
          onClick={() => reset()}
          size="lg"
          className="w-full h-11 text-sm"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新页面
        </Button>
      </div>
    </div>
  );
}