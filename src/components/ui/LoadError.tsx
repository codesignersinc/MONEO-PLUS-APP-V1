'use client';
import React from 'react';
import { getErrorMessage } from '@/lib/dataError';

interface LoadErrorProps {
  /** What failed to load, e.g. "tus cuentas". */
  what: string;
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

// Shown only when a load request FAILED. Never use it for an empty result:
// empty results keep each page's own empty state.
export default function LoadError({ what, error, onRetry, className = '' }: LoadErrorProps) {
  return (
    <div
      role="alert"
      className={`rounded-2xl border-[3px] border-black bg-[#FEE2E2] shadow-[4px_4px_0px_#000] p-5 text-center ${className}`}
    >
      <div className="text-3xl mb-2" aria-hidden="true">
        ⚠️
      </div>
      <p className="font-black text-black text-base mb-1">No pudimos cargar {what}</p>
      <p className="text-sm text-black/70 mb-4">{getErrorMessage(error)}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-5 py-2.5 rounded-xl border-[3px] border-black bg-white text-black text-sm font-black shadow-[2px_2px_0px_#000] active:shadow-none active:translate-y-px transition-all"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
