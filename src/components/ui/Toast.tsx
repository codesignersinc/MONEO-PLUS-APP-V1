'use client';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { getErrorMessage } from '@/lib/dataError';

type ToastVariant = 'error' | 'success';

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastApi {
  showError: (errorOrMessage: unknown) => void;
  showSuccess: (message: string) => void;
}

const noop: ToastApi = {
  showError: (e) => console.error(e),
  showSuccess: () => {},
};

const ToastContext = createContext<ToastApi>(noop);

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const DURATION_MS = 4500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-2), { id, variant, message }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss]
  );

  const api = React.useMemo<ToastApi>(
    () => ({
      showError: (errorOrMessage) => {
        if (typeof errorOrMessage !== 'string') console.error(errorOrMessage);
        push(
          'error',
          typeof errorOrMessage === 'string' ? errorOrMessage : getErrorMessage(errorOrMessage)
        );
      },
      showSuccess: (message) => push('success', message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-28 lg:bottom-6 w-[calc(100%-2rem)] max-w-sm flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.variant === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border-[3px] border-black px-4 py-3 shadow-[4px_4px_0px_#000] animate-slide-up ${
              t.variant === 'error' ? 'bg-[#FEE2E2]' : 'bg-[#DCFCE7]'
            }`}
          >
            <span aria-hidden="true">{t.variant === 'error' ? '⚠️' : '✅'}</span>
            <p className="flex-1 text-sm font-bold text-black">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Cerrar aviso"
              className="text-black/60 hover:text-black font-black leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
