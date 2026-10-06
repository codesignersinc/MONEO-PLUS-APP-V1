'use client';
import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Car,
  CreditCard,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  Home,
  MoreHorizontal,
  Plane,
  ShoppingBag,
  Shirt,
  Tag,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { getCurrencyInfo } from '@/lib/currency';

// Home building blocks (MONEO 3D retro pop): cream page, white cards with a 2px black
// border and a short hard shadow, big numbers.

export const HOME = {
  cream: '#FFF9EC',
  yellow: '#FFD83D',
  black: '#111111',
  mint: '#45D98B',
  lilac: '#B99CFF',
  coral: '#FF806E',
  blue: '#75B8FF',
};

export const card =
  'rounded-[22px] border-2 border-[#111] bg-white shadow-[0_3px_0_#111] transition-[transform,box-shadow] duration-150 motion-reduce:transition-none';
export const interactive =
  'hover:-translate-y-px hover:shadow-[0_4px_0_#111] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#75B8FF] motion-reduce:hover:translate-y-0';

export function moneyFormatter(currency: string) {
  const symbol = getCurrencyInfo(currency).symbol;
  return (n: number, opts: { sign?: boolean; decimals?: boolean } = {}) => {
    const decimals = opts.decimals ?? true;
    const abs = Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    });
    const sign = opts.sign ? (n < 0 ? '- ' : '+ ') : n < 0 ? '- ' : '';
    return `${sign}${symbol} ${abs}`;
  };
}
export type Money = ReturnType<typeof moneyFormatter>;

export function CardHead({
  title,
  icon,
  href,
  link = 'Ver todos',
  right,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  href?: string;
  link?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <h2 className="shrink-0 whitespace-nowrap text-[17px] font-black tracking-tight text-[#111]">
        {title}
      </h2>
      <span className="flex min-w-0 flex-1 justify-end">{right}</span>
      {href && (
        <Link
          href={href}
          className="flex shrink-0 items-center gap-1 rounded-lg px-1 text-[13px] font-bold text-[#2F62F0] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75B8FF]"
        >
          {link} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

const CATEGORY_ICONS: [RegExp, LucideIcon][] = [
  [/comida|restaur|delivery|caf|aliment|super/i, Utensils],
  [/transport|taxi|uber|gasolin|auto/i, Car],
  [/compra|tienda|ropa/i, ShoppingBag],
  [/entreten|ocio|salida|cine|juego/i, Gamepad2],
  [/suscrip|stream/i, CreditCard],
  [/vivienda|casa|hogar|alquiler|servicio/i, Home],
  [/salud|farmac|m[eé]dic/i, HeartPulse],
  [/educa/i, GraduationCap],
  [/viaje/i, Plane],
  [/moda|vest/i, Shirt],
  [/sueldo|salario|ingreso/i, Wallet],
  [/luz|agua|internet|tel[eé]f/i, Zap],
  [/^otros?$/i, MoreHorizontal],
];

export function categoryIcon(category: string): LucideIcon {
  return CATEGORY_ICONS.find(([re]) => re.test(category))?.[1] ?? Tag;
}

// Soft tile colours used for categories (cycled).
export const TILE_COLORS = ['#DDF7E9', '#FFF3B8', '#EDE5FF', '#DCEBFF', '#FFE1DB', '#F1F1EF'];
export const BAR_COLORS = ['#45D98B', '#FFD83D', '#B99CFF', '#75B8FF', '#FF806E', '#D9D9D6'];

export function EmptyNote({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#111]/25 px-4 py-6 text-center text-sm font-semibold text-gray-600">
      {children}
      {action}
    </div>
  );
}

export function SmallLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-xl border-2 border-[#111] bg-[#FFD83D] px-3 py-1.5 text-[13px] font-black text-[#111] shadow-[0_2px_0_#111] hover:-translate-y-px"
    >
      {children}
    </Link>
  );
}
