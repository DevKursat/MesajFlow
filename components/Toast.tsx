
import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const config = {
    SUCCESS: { icon: <CheckCircle className="text-emerald-500" />, bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    ERROR: { icon: <XCircle className="text-rose-500" />, bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
    WARN: { icon: <AlertTriangle className="text-amber-500" />, bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    INFO: { icon: <Info className="text-blue-500" />, bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  }[type];

  return (
    <div className={`fixed bottom-10 right-10 z-[100] min-w-[320px] ${config.bg} border ${config.border} backdrop-blur-xl rounded-2xl p-5 shadow-2xl animate-in slide-in-from-right-10 flex items-center gap-4 group`}>
      <div className="flex-shrink-0">{config.icon}</div>
      <div className="flex-1">
        <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-0.5">{type}</p>
        <p className="text-sm font-bold text-zinc-200">{message}</p>
      </div>
      <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-all text-zinc-600">
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;
