'use client';
import React, { useState } from 'react';
import {
  CreditCard,
  Landmark,
  Smartphone,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { findBank, findService } from '@/lib/brands';

// Logo tile for accounts, debts and subscriptions: the bank / service logo when known,
// otherwise a type icon (accounts, debts) or the brand initial (subscriptions).
// Never shows the stored emoji.

const TYPE_ICONS: Record<string, LucideIcon> = {
  banco: Landmark,
  efectivo: Wallet,
  digital: Smartphone,
  credito: CreditCard,
  inversion: TrendingUp,
};

const SIZES = { sm: 'w-9 h-9', md: 'w-11 h-11', lg: 'w-12 h-12' } as const;

interface Props {
  kind: 'account' | 'debt' | 'subscription';
  name: string;
  institution?: string;
  type?: string; // account type (banco, efectivo, digital, credito, inversion) or debt type
  color?: string;
  size?: keyof typeof SIZES;
}

export default function BrandLogo({ kind, name, institution, type, color, size = 'md' }: Props) {
  const [broken, setBroken] = useState(false);
  const bank = kind === 'subscription' ? undefined : findBank(institution, name);
  const service = kind === 'subscription' ? findService(name) : undefined;
  const image = bank?.image ?? service?.logoUrl;
  const box = `${SIZES[size]} rounded-xl border-[2px] border-black flex items-center justify-center flex-shrink-0 overflow-hidden`;

  if (image && !broken) {
    return (
      <div className={`${box} bg-white p-1`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={bank?.name ?? service?.name ?? name}
          className="w-full h-full object-contain"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }

  if (kind === 'subscription') {
    const bg = service?.color ?? color ?? '#111827';
    return (
      <div className={`${box} text-white font-black text-base`} style={{ background: bg }}>
        {(name.trim()[0] ?? '?').toUpperCase()}
      </div>
    );
  }

  const isCard = kind === 'debt' ? /tarjeta|cr[eé]dito/i.test(type ?? '') : false;
  const Icon =
    kind === 'debt' ? (isCard ? CreditCard : Landmark) : (TYPE_ICONS[type ?? ''] ?? Landmark);
  return (
    <div className={`${box} bg-[#FFD43B]`}>
      <Icon className="w-5 h-5 text-black" strokeWidth={2} aria-hidden="true" />
    </div>
  );
}
