'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, ArrowLeftRight, Wallet, TrendingUp, CreditCard, Landmark, CalendarDays, BarChart3, Settings2, LogOut, Zap, Target, DollarSign, Receipt, ChevronLeft, ChevronRight, Users, RefreshCw } from 'lucide-react';
import MoneoLogo from '@/components/ui/MoneoLogo';
import NotificationBell from '@/components/notifications/NotificationBell';



interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  special?: boolean;
}

const navItems: NavItem[] = [
  { href: '/finanzas',                label: 'Inicio',         icon: LayoutDashboard },
  { href: '/finanzas/movimientos',    label: 'Movimientos',    icon: ArrowLeftRight  },
  { href: '/finanzas/ingresos',       label: 'Ingresos',       icon: DollarSign      },
  { href: '/finanzas/pagos',          label: 'Pagos',          icon: Receipt         },
  { href: '/finanzas/suscripciones',  label: 'Suscripciones',  icon: Zap             },
  { href: '/finanzas/presupuesto',    label: 'Presupuesto',    icon: Wallet          },
  { href: '/finanzas/ahorros',        label: 'Metas',          icon: Target          },
  { href: '/finanzas/juntas',         label: 'Juntas',         icon: Users,          special: true },
  { href: '/finanzas/cuentas',        label: 'Cuentas',        icon: Landmark        },
  { href: '/finanzas/convertir',      label: 'Convertir',      icon: RefreshCw       },
  { href: '/finanzas/deudas',         label: 'Deudas',         icon: CreditCard      },
  { href: '/finanzas/inversiones',    label: 'Inversiones',    icon: TrendingUp      },
  { href: '/finanzas/calendario',     label: 'Calendario',     icon: CalendarDays    },
  { href: '/finanzas/reportes',       label: 'Reportes',       icon: BarChart3       },
  { href: '/finanzas/configuracion',  label: 'Configuración',  icon: Settings2       },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === '/finanzas') return pathname === '/finanzas';
    return pathname.startsWith(href);
  };

  async function handleSignOut() {
    try {
      await signOut();
      router.replace('/login');
    } catch {}
  }

  return (
    <aside
      className={`hidden lg:flex flex-col min-h-screen bg-white border-r-2 border-black fixed left-0 top-0 z-30 transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-60'}`}
    >
      {/* Logo + notification bell + collapse toggle */}
      <div className={`flex items-center border-b-2 border-black ${collapsed ? 'justify-center px-3 py-5 flex-col gap-2' : 'gap-2 px-4 py-5'}`}>
        {!collapsed && (
          <div className="flex items-center gap-1.5 flex-1">
            <MoneoLogo width={100} height={36} />
          </div>
        )}
        {collapsed && (
          <Zap className="w-6 h-6 text-[#FFD93D] fill-[#FFD93D]" strokeWidth={2.5} />
        )}
        {/* Notification bell */}
        <div className={collapsed ? 'w-full flex justify-center' : ''}>
          <NotificationBell />
        </div>
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className={`flex items-center justify-center w-7 h-7 rounded-lg border-2 border-black bg-white hover:bg-[#FFD93D] transition-all duration-200 shadow-[1px_1px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-px shrink-0 ${collapsed ? 'mt-0' : ''}`}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4 text-black" strokeWidth={2.5} />
            : <ChevronLeft className="w-4 h-4 text-black" strokeWidth={2.5} />
          }
        </button>
      </div>

      {/* Tagline (only when expanded) */}
      {!collapsed && (
        <div className="px-6 pb-4 pt-1 border-b-2 border-black">
          <p className="text-[11px] text-gray-500 font-medium">Tu dinero, más simple.</p>
        </div>
      )}

      {/* Nav items */}
      <nav className={`flex-1 py-4 space-y-0.5 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
        {navItems.map((item) => {
          const active = isActive(item.href);
          const ItemIcon = item.icon;

          if (item.special) {
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`group flex items-center rounded-xl text-sm font-bold transition-all duration-200 border-2 ${
                  collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                } ${
                  active
                    ? 'bg-[#FFD43B] text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-[#FFD43B] text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.6)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:shadow-none active:translate-y-0'
                }`}
              >
                <ItemIcon
                  className="flex-shrink-0 w-[18px] h-[18px] text-black"
                  strokeWidth={2.5}
                />
                {!collapsed && (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <div className="min-w-0">
                      <div className="font-black text-black text-sm leading-tight">Juntas</div>
                      <div className="text-[10px] font-medium text-black/70 leading-tight">Ahorra en grupo</div>
                    </div>
                    <span className="ml-1 px-1.5 py-0.5 bg-black text-[#FFD43B] text-[9px] font-black rounded-full leading-none shrink-0">
                      NUEVO
                    </span>
                  </div>
                )}
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`group flex items-center rounded-xl text-sm font-medium transition-all duration-200 ${
                collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                active
                  ? 'bg-[#FFD93D] text-black font-bold border-[3px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-black'
              }`}
            >
              <ItemIcon
                className={`flex-shrink-0 transition-all duration-200 ${collapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]'} ${
                  active
                    ? 'text-black' : 'text-gray-400 group-hover:text-black group-hover:scale-110'
                }`}
                strokeWidth={2}
              />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* Decorative bottom (only when expanded) */}
      {!collapsed && (
        <div className="px-4 py-3 border-t-2 border-black bg-[#FAFAF8]">
          <div className="bg-[#FFD93D] rounded-2xl border-[3px] border-black p-3 mb-3">
            <p className="text-xs font-black text-black leading-tight">Pequeñas decisiones,</p>
            <p className="text-xs font-black text-black leading-tight">grandes resultados.</p>
          </div>
        </div>
      )}

      {/* User + Logout */}
      <div className={`py-4 border-t-2 border-black space-y-2 ${collapsed ? 'px-2' : 'px-4'}`}>
        {user && !collapsed && (
          <div className="flex items-center gap-2 px-1 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => router.push('/finanzas/configuracion')}>
            <div className="w-7 h-7 rounded-full bg-[#4ADE80] border-[3px] border-black flex items-center justify-center text-xs font-black text-black shrink-0">
              {user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <p className="text-xs text-gray-500 truncate flex-1">{user.email}</p>
          </div>
        )}
        {user && collapsed && (
          <div className="flex justify-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => router.push('/finanzas/configuracion')}>
            <div className="w-8 h-8 rounded-full bg-[#4ADE80] border-[3px] border-black flex items-center justify-center text-xs font-black text-black shrink-0">
              {user.email?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
        )}
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
      </div>
    </aside>
  );
}
