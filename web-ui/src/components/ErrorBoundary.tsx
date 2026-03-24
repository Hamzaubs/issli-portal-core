// apps/web-ui/src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-800 p-8 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md border border-slate-200">
            <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-2xl font-black mb-2">Oups ! Une erreur est survenue.</h1>
            <p className="text-slate-500 mb-6 text-sm">
                Le système a rencontré un problème inattendu. Données protégées.
            </p>
            <div className="bg-slate-100 p-3 rounded text-xs font-mono text-left mb-6 text-slate-600 overflow-auto max-h-32">
                {this.state.error?.message}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw size={18} /> Recharger l'application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}