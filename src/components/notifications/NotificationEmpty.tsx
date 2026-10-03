'use client';
import React from 'react';

export default function NotificationEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl border-[3px] border-black bg-[#FFD43B] flex items-center justify-center text-3xl shadow-[4px_4px_0px_#000] mb-4">
        🔔
      </div>
      <p className="font-black text-black text-sm uppercase tracking-wide leading-tight">
        Todo tranquilo por aquí
      </p>
      <p className="text-xs text-gray-500 mt-1 leading-snug max-w-[200px]">
        Cuando haya algo importante para ti, aparecerá aquí.
      </p>
    </div>
  );
}
