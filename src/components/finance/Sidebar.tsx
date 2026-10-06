'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  TrendingUp,
  CreditCard,
  Landmark,
  CalendarDays,
  BarChart3,
  Settings2,
  LogOut,
  Zap,
  Target,
  DollarSign,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Users,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import MoneoLogo from '@/components/ui/MoneoLogo';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useToast } from '@/components/ui/Toast';
import { PlusCard } from '@/components/dashboard/RailCards';
import { ONBOARDING_V2 } from '@/lib/onboardingFlow';
import { entitlementService, type Entitlement } from '@/lib/billing';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  special?: boolean;
}

const navItems: NavItem[] = [
  { href: '/finanzas', label: 'Inicio', icon: LayoutDashboard },
  { href: '/finanzas/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { href: '/finanzas/auto', label: 'MONEO AUTO', icon: Sparkles },
  { href: '/finanzas/ingresos', label: 'Ingresos', icon: DollarSign },
  { href: '/finanzas/movimientos?tipo=gastos', label: 'Gastos', icon: ShoppingBag },
  { href: '/finanzas/pagos', label: 'Pagos', icon: Receipt },
  { href: '/finanzas/suscripciones', label: 'Suscripciones', icon: Zap },
  { href: '/finanzas/presupuesto', label: 'Presupuesto', icon: Wallet },
  { href: '/finanzas/ahorros', label: 'Metas', icon: Target },
  { href: '/finanzas/juntas', label: 'Juntas', icon: Users, special: true },
  { href: '/finanzas/cuentas', label: 'Cuentas', icon: Landmark },
  { href: '/finanzas/deudas', label: 'Deudas', icon: CreditCard },
  { href: '/finanzas/inversiones', label: 'Inversiones', icon: TrendingUp },
  { href: '/finanzas/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/finanzas/reportes', label: 'Reportes', icon: BarChart3 },
  { href: '/finanzas/configuracion', label: 'Configuración', icon: Settings2 },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const isActive = (href: string) => {
    if (href.includes('?')) return false; // filter links (Gastos) never mark the section
    if (href === '/finanzas') return pathname === '/finanzas';
    return pathname.startsWith(href);
  };

  // MONEO PLUS status for the card at the bottom (only where the plans are live).
  const [ent, setEnt] = useState<Entitlement | null | undefined>(undefined);
  useEffect(() => {
    if (!ONBOARDING_V2 || !user) return;
    entitlementService
      .get()
      .then(setEnt)
      .catch(() => setEnt(undefined));
  }, [user]);
  const home = pathname === '/finanzas';

  async function handleSignOut() {
    try {
      await signOut();
      router.replace('/');
    } catch (err) {
      toast.showError(err);
    }
  }

  return (
    <aside
      className={`hidden lg:flex flex-col h-screen bg-white text-[#111] border-r-2 border-black fixed left-0 top-0 z-30 transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-60'}`}
    >
      {/* Logo + tagline + notification bell (the Home has its own) + collapse toggle */}
      <div
        className={`flex items-start ${collapsed ? 'justify-center px-3 py-5 flex-col items-center gap-2' : 'gap-2 px-5 pb-2 pt-5'}`}
      >
        {!collapsed && (
          <div className="flex-1">
            <MoneoLogo width={132} height={48} />
            <p className="mt-1 whitespace-nowrap text-[12px] font-medium text-[#111]/80">
              Tu dinero, más simple.
            </p>
          </div>
        )}
        {collapsed && <Zap className="w-6 h-6 text-[#FFD93D] fill-[#FFD93D]" strokeWidth={2.5} />}
        {!home && (
          <div className={collapsed ? 'w-full flex justify-center' : ''}>
            <NotificationBell />
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="flex items-center justify-center w-7 h-7 rounded-lg border-2 border-black bg-white hover:bg-[#FFD93D] transition-all duration-200 shrink-0"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-black" strokeWidth={2.5} />
          ) : (
            <ChevronLeft className="w-4 h-4 text-black" strokeWidth={2.5} />
          )}
        </button>
      </div>

      {/* Nav items */}
      <nav
        aria-label="Secciones"
        className={`flex-1 py-2 space-y-1 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}
      >
        {navItems.map((item) => {
          const active = isActive(item.href);
          const ItemIcon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-current={active ? 'page' : undefined}
              className={`group flex items-center rounded-xl border-2 text-[14.5px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75B8FF] ${
                collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-[5px]'
              } ${
                active
                  ? 'bg-[#FFD83D] text-[#111] font-black border-[#111] shadow-[0_2px_0_#111]'
                  : 'border-transparent font-medium text-[#111] hover:bg-[#FFF9EC]'
              }`}
            >
              <ItemIcon
                className={`flex-shrink-0 text-[#111] ${collapsed ? 'w-5 h-5' : 'w-[19px] h-[19px]'}`}
                strokeWidth={active ? 2.6 : 2.1}
              />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && item.special && (
                <span className="rounded-full border-2 border-[#111] bg-[#FFD83D] px-1.5 py-0.5 text-[9px] font-black leading-none">
                  NUEVO
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* MONEO PLUS (where the plans are live) or the brand note */}
      {!collapsed && (
        <div className="shrink-0 px-4 pb-2 pt-3">
          {ONBOARDING_V2 && ent !== undefined ? (
            <PlusCard ent={ent} variant="sidebar" />
          ) : (
            <div className="bg-[#FFD93D] rounded-2xl border-2 border-black p-3">
              <p className="text-xs font-black text-black leading-tight">Pequeñas decisiones,</p>
              <p className="text-xs font-black text-black leading-tight">grandes resultados.</p>
            </div>
          )}
        </div>
      )}

      {/* User + Logout */}
      <div
        className={`shrink-0 py-2 border-t-2 border-black/10 space-y-1 ${collapsed ? 'px-2' : 'px-4'}`}
      >
        {user && !collapsed && (
          <div className="flex items-center gap-2 px-1">
            <button
              type="button"
              onClick={() => router.push('/finanzas/configuracion')}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg hover:opacity-80"
            >
              <span className="w-7 h-7 rounded-full bg-[#4ADE80] border-2 border-black flex items-center justify-center text-xs font-black text-black shrink-0">
                {user.email?.[0]?.toUpperCase() || 'U'}
              </span>
              <span className="text-xs text-gray-600 truncate">{user.email}</span>
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-red-500 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" strokeWidth={2.2} />
            </button>
          </div>
        )}
        {user && collapsed && (
          <div
            className="flex justify-center cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => router.push('/finanzas/configuracion')}
          >
            <div className="w-8 h-8 rounded-full bg-[#4ADE80] border-[3px] border-black flex items-center justify-center text-xs font-black text-black shrink-0">
              {user.email?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
        )}
        {collapsed && (
          <button
            onClick={handleSignOut}
            title={collapsed ? 'Cerrar sesión' : undefined}
            className={`group w-full flex items-center rounded-xl text-sm text-red-500 hover:bg-red-50 transition-all duration-200 font-medium ${collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2'}`}
          >
            <LogOut
              className="w-4 h-4 transition-all duration-200 group-hover:translate-x-0.5 group-hover:scale-110"
              strokeWidth={2}
            />
            {!collapsed && 'Cerrar sesión'}
          </button>
        )}
      </div>
    </aside>
  );
}
