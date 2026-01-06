
import React, { ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';
import { logError } from '../services/supabaseService';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary class to catch and handle UI rendering errors gracefully.
 * Fix: Explicitly extending React.Component and using this.setState/this.props properly.
 */
class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError('UI_RENDER', error.message, { stack: error.stack, info: errorInfo }, 'CRITICAL');
  }

  // Fix for line 32: Correctly accessing setState from the React.Component base class
  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-zinc-100 font-['Inter']">
          <div className="max-w-xl w-full bg-[#0a0a0b] border border-rose-500/20 rounded-[3rem] p-12 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent" />
            
            <div className="w-24 h-24 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(244,63,94,0.1)]">
              <AlertOctagon size={48} />
            </div>

            <h1 className="text-3xl font-black uppercase tracking-tighter mb-4">Sistem <span className="text-rose-500">Hatası</span></h1>
            <p className="text-zinc-500 text-sm leading-relaxed mb-10">
              Uygulama çalışırken beklenmedik bir teknik sorunla karşılaştı. Teknik ekip bilgilendirildi. Lütfen sayfayı yenilemeyi deneyin.
            </p>

            <div className="bg-black/40 rounded-2xl p-6 mb-10 border border-white/5 text-left">
               <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest mb-2">Hata Raporu</p>
               <p className="text-xs font-mono text-rose-400/80 break-words">{this.state.error?.message || 'Bilinmeyen hata'}</p>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => window.location.reload()}
                className="flex-1 bg-white/5 border border-white/10 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all flex items-center justify-center gap-3"
              >
                <RefreshCw size={18} /> SAYFAYI YENİLE
              </button>
              <button 
                onClick={this.handleReset}
                className="flex-1 bg-emerald-500 text-black py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-400 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20"
              >
                <Home size={18} /> ANA SAYFAYA DÖN
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Fix for line 77: Correctly accessing children from props as inherited from the React.Component base class
    return this.props.children;
  }
}

export default ErrorBoundary;
