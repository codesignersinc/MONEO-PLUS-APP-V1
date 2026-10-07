'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Plus,
  X,
  LayoutDashboard,
  ArrowLeftRight,
  DollarSign,
  Receipt,
  Zap,
  Wallet,
  Target,
  Sofa,
  Landmark,
  CreditCard,
  TrendingUp,
  CalendarDays,
  BarChart3,
  Settings2,
  LogOut,
  Users,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import MoneoLogo from '@/components/ui/MoneoLogo';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useToast } from '@/components/ui/Toast';
import { notifyDataChanged } from '@/lib/dataSync';
import GastoForm from '@/components/finance/quickForms/GastoForm';
import IngresoForm from '@/components/finance/quickForms/IngresoForm';
import PagoForm from '@/components/finance/quickForms/PagoForm';
import SuscripcionForm from '@/components/finance/quickForms/SuscripcionForm';
import TransferenciaForm from '@/components/finance/quickForms/TransferenciaForm';
import AhorroForm from '@/components/finance/quickForms/AhorroForm';

const sideNavItems = [
  { href: '/finanzas', label: 'Inicio', icon: LayoutDashboard },
  { href: '/finanzas/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { href: '/finanzas/auto', label: 'MONEO AUTO', icon: Sparkles },
  { href: '/finanzas/ingresos', label: 'Ingresos', icon: DollarSign },
  { href: '/finanzas/pagos', label: 'Pagos', icon: Receipt },
  { href: '/finanzas/suscripciones', label: 'Suscripciones', icon: Zap },
  { href: '/finanzas/presupuesto', label: 'Presupuesto', icon: Wallet },
  { href: '/finanzas/ahorros', label: 'Metas', icon: Target },
  { href: '/finanzas/hogar', label: 'Hogar', icon: Sofa },
  { href: '/finanzas/cuentas', label: 'Cuentas', icon: Landmark },
  { href: '/finanzas/convertir', label: 'Convertir', icon: RefreshCw },
  { href: '/finanzas/deudas', label: 'Deudas', icon: CreditCard },
  { href: '/finanzas/inversiones', label: 'Inversiones', icon: TrendingUp },
  { href: '/finanzas/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/finanzas/reportes', label: 'Reportes', icon: BarChart3 },
  { href: '/finanzas/configuracion', label: 'Configuración', icon: Settings2 },
];

const registerOptions = [
  {
    key: 'gasto',
    label: 'Gasto',
    desc: 'Una nueva compra o pago de tu día a día.',
    bg: 'bg-[#fde899]',
    iconBg: 'bg-[#F5C518]',
    emoji: '🧾',
    image: '/assets/images/Gasto-1790881903847.jpg',
  },
  {
    key: 'ingreso',
    label: 'Ingreso',
    desc: 'Tu sueldo u otro ingreso de dinero.',
    bg: 'bg-[#e1c2fd]',
    iconBg: 'bg-[#C084FC]',
    emoji: '➕',
    image: '/assets/images/Ingreso-1790881903846.jpg',
  },
  {
    key: 'pago',
    label: 'Pago',
    desc: 'Facturas, servicios, alquiler o cualquier obligación.',
    bg: 'bg-[#ffd5cc]',
    iconBg: 'bg-[#F87171]',
    emoji: '📅',
    image: '/assets/images/pagos-1790881903843.jpg',
  },
  {
    key: 'suscripcion',
    label: 'Suscripción',
    desc: 'Netflix, Spotify, apps y servicios recurrentes.',
    bg: 'bg-[#bfdbfe]',
    iconBg: 'bg-[#3B82F6]',
    emoji: '📺',
    image: '/assets/images/suscripcion-1790881904159.jpg',
  },
  {
    key: 'transferencia',
    label: 'Transferencia',
    desc: 'Entre tus cuentas o a otra persona.',
    bg: 'bg-[#fe9a82]',
    iconBg: 'bg-[#F97316]',
    emoji: '⇄',
    image: '/assets/images/transferencia-1790882160086.jpg',
  },
  {
    key: 'ahorro',
    label: 'Ahorro',
    desc: 'Para una meta o fondo de emergencia.',
    bg: 'bg-[#BBF7D0]',
    iconBg: 'bg-[#22C55E]',
    emoji: '🏠',
    image: '/assets/images/ahorros-1790881903843.jpg',
  },
];

type FormKey = 'gasto' | 'ingreso' | 'pago' | 'suscripcion' | 'transferencia' | 'ahorro' | null;

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeForm, setActiveForm] = useState<FormKey>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const toast = useToast();

  const isActive = (href: string) => {
    if (href === '/finanzas') return pathname === '/finanzas';
    return pathname.startsWith(href);
  };

  const moreActive = [
    '/finanzas/cuentas',
    '/finanzas/ahorros',
    '/finanzas/deudas',
    '/finanzas/inversiones',
    '/finanzas/suscripciones',
    '/finanzas/configuracion',
    '/finanzas/patrimonio',
    '/finanzas/reportes',
    '/finanzas/calendario',
    '/finanzas/ingresos',
    '/finanzas/pagos',
    '/finanzas/juntas',
  ].some((h) => pathname.startsWith(h));

  async function handleSignOut() {
    try {
      await signOut();
      router.replace('/');
    } catch (err) {
      toast.showError(err);
    }
    setSidebarOpen(false);
  }

  function handleOptionClick(key: FormKey) {
    setActiveForm(key);
    setSuccessMsg('');
  }

  function handleFormClose() {
    setActiveForm(null);
  }

  function handleFormSuccess() {
    notifyDataChanged();
    setActiveForm(null);
    setSuccessMsg('¡Registrado con éxito! ✅');
    setTimeout(() => {
      setSheetOpen(false);
      setSuccessMsg('');
    }, 1200);
  }

  function handleSheetClose() {
    setSheetOpen(false);
    setActiveForm(null);
    setSuccessMsg('');
  }

  return (
    <>
      {/* ── Hamburger button (top-right, mobile only) removed — "Más" in bottom nav handles this ── */}

      {/* ── Right Sidebar Overlay ── */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex justify-end"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-72 max-w-[85vw] h-full bg-white border-l-2 border-black flex flex-col overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-black">
              <div className="flex items-center gap-1.5">
                <MoneoLogo width={90} height={33} />
              </div>
              <div className="flex items-center gap-2">
                <NotificationBell />
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4 text-black" strokeWidth={2.5} />
                </button>
              </div>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5">
              {/* Juntas highlighted entry */}
              <Link
                href="/finanzas/juntas"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 border-2 mb-2 ${
                  isActive('/finanzas/juntas')
                    ? 'bg-[#FFD43B] text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-[#FFD43B] text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                }`}
              >
                <Users className="w-[18px] h-[18px] flex-shrink-0 text-black" strokeWidth={2.5} />
                <div className="flex-1 min-w-0">
                  <div className="font-black text-black text-sm leading-tight">Juntas</div>
                  <div className="text-[10px] font-medium text-black/70 leading-tight">
                    Ahorra en grupo
                  </div>
                </div>
                <span className="px-1.5 py-0.5 bg-black text-[#FFD43B] text-[9px] font-black rounded-full leading-none shrink-0">
                  NUEVO
                </span>
              </Link>
              {sideNavItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      active
                        ? 'bg-[#FFD93D] text-black font-bold border-[3px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-black'
                    }`}
                  >
                    <Icon
                      className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-black' : 'text-gray-400'}`}
                      strokeWidth={2}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="px-4 py-4 border-t-2 border-black space-y-2">
              {user && (
                <div className="flex items-center gap-2 px-1">
                  <div className="w-7 h-7 rounded-full bg-[#4ADE80] border-[3px] border-black flex items-center justify-center text-xs font-black text-black shrink-0">
                    {user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <p className="text-xs text-gray-500 truncate flex-1">{user.email}</p>
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-all duration-200 font-medium"
              >
                <LogOut className="w-4 h-4" strokeWidth={2} />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom Sheet ── */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end" onClick={handleSheetClose}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full bg-[#F5F0E8] rounded-t-3xl border-t-2 border-black sheet-max overflow-y-auto pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* close button */}
            <button
              onClick={handleSheetClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-full border-2 border-black bg-white flex items-center justify-center z-10"
            >
              <X className="w-4 h-4 text-black" strokeWidth={2.5} />
            </button>

            {/* success message */}
            {successMsg && (
              <div className="mx-4 mt-4 px-4 py-3 bg-green-100 border-2 border-green-500 rounded-2xl text-center">
                <p className="text-sm font-black text-green-700">{successMsg}</p>
              </div>
            )}

            {/* ── Step 1: option list ── */}
            {!activeForm && !successMsg && (
              <>
                <div className="px-5 pt-2 pb-4">
                  <h2 className="text-2xl font-black text-black leading-tight">
                    ¿Qué quieres
                    <br />
                    registrar?
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Elige una opción para continuar.</p>
                </div>
                <div className="px-4 pb-8 space-y-3">
                  {registerOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => handleOptionClick(opt.key as FormKey)}
                      className={`w-full flex items-center rounded-2xl border-2 border-black overflow-hidden shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-0.5 transition-all ${opt.bg}`}
                    >
                      {/* text */}
                      <div className="flex-1 px-4 py-3 text-left">
                        <p className="text-base font-black text-black">{opt.label}</p>
                        <p className="text-xs text-gray-600 leading-snug mt-0.5">{opt.desc}</p>
                      </div>
                      {/* illustration image + arrow */}
                      <div className="relative flex items-center self-stretch">
                        {opt.image && (
                          <div className="h-full w-20 relative overflow-hidden">
                            <Image
                              src={opt.image}
                              alt={opt.label}
                              fill
                              sizes="80px"
                              className="object-cover object-center"
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-center w-8 h-full z-10">
                          <span className="text-gray-600 text-xl font-bold">›</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ── Step 2: inline form ── */}
            {activeForm === 'gasto' && (
              <GastoForm onClose={handleFormClose} onSuccess={handleFormSuccess} />
            )}
            {activeForm === 'ingreso' && (
              <IngresoForm onClose={handleFormClose} onSuccess={handleFormSuccess} />
            )}
            {activeForm === 'pago' && (
              <PagoForm onClose={handleFormClose} onSuccess={handleFormSuccess} />
            )}
            {activeForm === 'suscripcion' && (
              <SuscripcionForm onClose={handleFormClose} onSuccess={handleFormSuccess} />
            )}
            {activeForm === 'transferencia' && (
              <TransferenciaForm onClose={handleFormClose} onSuccess={handleFormSuccess} />
            )}
            {activeForm === 'ahorro' && (
              <AhorroForm onClose={handleFormClose} onSuccess={handleFormSuccess} />
            )}
          </div>
        </div>
      )}

      {/* ── Bottom Nav Bar ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-black border-t border-gray-800 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around px-2 pt-2 pb-4 relative max-w-lg mx-auto">
          {/* Inicio */}
          <Link
            href="/finanzas"
            className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px]"
          >
            <Home
              className={`w-6 h-6 ${isActive('/finanzas') ? 'text-[#FFD93D]' : 'text-gray-400'}`}
              strokeWidth={2}
            />
            <span
              className={`text-[10px] font-bold ${isActive('/finanzas') ? 'text-[#FFD93D]' : 'text-gray-400'}`}
            >
              Inicio
            </span>
          </Link>

          {/* Movimientos */}
          <Link
            href="/finanzas/movimientos"
            className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px]"
          >
            <svg
              className={`w-6 h-6 ${isActive('/finanzas/movimientos') ? 'text-[#FFD93D]' : 'text-gray-400'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
            </svg>
            <span
              className={`text-[10px] font-bold ${isActive('/finanzas/movimientos') ? 'text-[#FFD93D]' : 'text-gray-400'}`}
            >
              Movimientos
            </span>
          </Link>

          {/* FAB */}
          <div className="flex flex-col items-center -mt-8">
            <button
              onClick={() => setSheetOpen(true)}
              className="w-16 h-16 bg-[#FFD93D] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all duration-150"
            >
              <Plus className="w-8 h-8 text-black" strokeWidth={2.5} />
            </button>
          </div>

          {/* Hogar */}
          <Link
            href="/finanzas/hogar"
            className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px]"
          >
            <Sofa
              className={`w-6 h-6 ${isActive('/finanzas/hogar') ? 'text-[#FFD93D]' : 'text-gray-400'}`}
              strokeWidth={2}
            />
            <span
              className={`text-[10px] font-bold ${isActive('/finanzas/hogar') ? 'text-[#FFD93D]' : 'text-gray-400'}`}
            >
              Hogar
            </span>
          </Link>

          {/* Más */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px]"
          >
            <svg
              className={`w-6 h-6 ${moreActive ? 'text-[#FFD93D]' : 'text-gray-400'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span
              className={`text-[10px] font-bold ${moreActive ? 'text-[#FFD93D]' : 'text-gray-400'}`}
            >
              Más
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
