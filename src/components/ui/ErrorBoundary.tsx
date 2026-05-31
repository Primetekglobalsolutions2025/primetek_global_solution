'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import Card from './Card';
import Button from './Button';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <Card hover={false} className="max-w-md w-full p-8 text-center border-t-4 border-t-red-500 shadow-2xl">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">Something went wrong</h2>
            <p className="text-text-secondary text-sm mb-8 leading-relaxed">
              We encountered an unexpected error while loading this component. Please try refreshing the page.
            </p>
            <div className="flex flex-col gap-3">
              <Button 
                variant="primary" 
                fullWidth 
                onClick={() => window.location.reload()}
                className="shadow-lg shadow-primary-500/20"
              >
                <RefreshCcw className="w-4 h-4 mr-2" /> Refresh Page
              </Button>
              <Button 
                variant="outline" 
                fullWidth 
                onClick={() => this.setState({ hasError: false })}
              >
                Try Again
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
