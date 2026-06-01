'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
  };
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = React.useMemo(() => ({
    success: (msg: string, dur?: number) => addToast('success', msg, dur),
    error: (msg: string, dur?: number) => addToast('error', msg, dur),
    info: (msg: string, dur?: number) => addToast('info', msg, dur),
    warning: (msg: string, dur?: number) => addToast('warning', msg, dur),
  }), [addToast]);

  return (
    <ToastContext.Provider value={{ toast, toasts, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastContainer({ toasts, removeToast }: { toasts: ToastMessage[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-5 z-[200] flex flex-col gap-3 max-w-sm sm:max-w-md w-full pointer-events-none px-4 md:px-0">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  const { type, message } = toast;

  const config = {
    success: {
      icon: <CheckCircle className="w-5 h-5 text-emerald-600" />,
      borderColor: 'border-emerald-200',
      bgColor: 'bg-white',
      textColor: 'text-emerald-800',
    },
    error: {
      icon: <AlertCircle className="w-5 h-5 text-rose-600" />,
      borderColor: 'border-rose-200',
      bgColor: 'bg-white',
      textColor: 'text-rose-800',
    },
    info: {
      icon: <Info className="w-5 h-5 text-sky-600" />,
      borderColor: 'border-sky-200',
      bgColor: 'bg-white',
      textColor: 'text-sky-800',
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
      borderColor: 'border-amber-200',
      bgColor: 'bg-white',
      textColor: 'text-amber-800',
    },
  }[type];

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border ${config.borderColor} ${config.bgColor} shadow-lg shadow-black/5 animate-in slide-in-from-bottom-4 fade-in duration-300 w-full`}
      role="alert"
    >
      <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
      <div className={`flex-1 text-xs font-bold leading-normal ${config.textColor}`}>
        {message}
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 text-zinc-400 hover:text-zinc-650 transition-colors p-0.5 rounded-lg hover:bg-zinc-100 border-0 cursor-pointer bg-transparent"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
