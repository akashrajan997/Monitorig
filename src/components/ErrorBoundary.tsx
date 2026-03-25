import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.operationType) {
          errorMessage = `Firestore ${parsed.operationType} failed: ${parsed.error}`;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-red-500 p-8 shadow-[8px_8px_0px_0px_rgba(239,68,68,1)]">
            <div className="flex items-center gap-3 mb-6 text-red-600">
              <AlertTriangle className="w-8 h-8" />
              <h2 className="text-xl font-bold uppercase tracking-tight">System Error</h2>
            </div>
            <p className="text-sm font-mono text-[#141414]/70 mb-8 leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-3 px-4 hover:bg-red-700 transition-colors font-mono text-sm uppercase tracking-wider"
            >
              <RefreshCw className="w-4 h-4" />
              Restart Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
