'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Plus, X, LayoutDashboard, ArrowLeftRight, DollarSign, Receipt, Zap, Wallet, Target, Landmark, CreditCard, TrendingUp, CalendarDays, BarChart3, Settings2, LogOut, ChevronLeft, Users, RefreshCw } from 'lucide-react';
import MoneoLogo from '@/components/ui/MoneoLogo';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { transactionsService, accountsService, subscriptionsService, savingsService } from '@/lib/supabaseFinance';
import Icon from '@/components/ui/AppIcon';
import NotificationBell from '@/components/notifications/NotificationBell';


interface MobileNavProps {
  onFabClick: () => void;
}

const sideNavItems = [
  { href: '/finanzas',               label: 'Inicio',        icon: LayoutDashboard },
  { href: '/finanzas/movimientos',   label: 'Movimientos',   icon: ArrowLeftRight  },
  { href: '/finanzas/ingresos',      label: 'Ingresos',      icon: DollarSign      },
  { href: '/finanzas/pagos',         label: 'Pagos',         icon: Receipt         },
  { href: '/finanzas/suscripciones', label: 'Suscripciones', icon: Zap             },
  { href: '/finanzas/presupuesto',   label: 'Presupuesto',   icon: Wallet          },
  { href: '/finanzas/ahorros',       label: 'Metas',         icon: Target          },
  { href: '/finanzas/cuentas',       label: 'Cuentas',       icon: Landmark        },
  { href: '/finanzas/convertir',     label: 'Convertir',     icon: RefreshCw       },
  { href: '/finanzas/deudas',        label: 'Deudas',        icon: CreditCard      },
  { href: '/finanzas/inversiones',   label: 'Inversiones',   icon: TrendingUp      },
  { href: '/finanzas/calendario',    label: 'Calendario',    icon: CalendarDays    },
  { href: '/finanzas/reportes',      label: 'Reportes',      icon: BarChart3       },
  { href: '/finanzas/configuracion', label: 'Configuración', icon: Settings2       },
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

const EXPENSE_CATEGORIES = [
  { label: 'Comida', icon: '🍽️' },
  { label: 'Transporte', icon: '🚗' },
  { label: 'Salud', icon: '💊' },
  { label: 'Entretenimiento', icon: '🎬' },
  { label: 'Ropa', icon: '👕' },
  { label: 'Hogar', icon: '🏠' },
  { label: 'Educación', icon: '📚' },
  { label: 'Otro', icon: '📦' },
];

const INCOME_CATEGORIES = [
  { label: 'Salario', icon: '💼' },
  { label: 'Freelance', icon: '💻' },
  { label: 'Negocio', icon: '🏪' },
  { label: 'Inversión', icon: '📈' },
  { label: 'Alquiler', icon: '🏠' },
  { label: 'Bono', icon: '🎁' },
  { label: 'Comisión', icon: '🤝' },
  { label: 'Otro', icon: '💰' },
];

const PAGO_CATEGORIES = [
  { label: 'Servicios', icon: '💡' },
  { label: 'Alquiler', icon: '🏠' },
  { label: 'Alimentación', icon: '🛒' },
  { label: 'Transporte', icon: '🚗' },
  { label: 'Salud', icon: '💊' },
  { label: 'Educación', icon: '📚' },
  { label: 'Entretenimiento', icon: '🎬' },
  { label: 'Otro', icon: '📦' },
];

const GOAL_ICONS = ['🐷', '🛡️', '✈️', '🚗', '💻', '🏠', '📱', '🎓', '💍', '🌟'];

type FormKey = 'gasto' | 'ingreso' | 'pago' | 'suscripcion' | 'transferencia' | 'ahorro' | null;

// ── Inline form components ──────────────────────────────────────────────────

function GastoForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Comida');
  const [categoryIcon, setCategoryIcon] = useState('🍽️');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCat = (label: string) => {
    const c = EXPENSE_CATEGORIES.find(x => x.label === label);
    setCategory(label);
    setCategoryIcon(c?.icon || '📦');
  };

  const handleSave = async () => {
    if (!name.trim() || !amount) { setError('Completa nombre y monto.'); return; }
    setSaving(true);
    try {
      const accounts = await accountsService.getAll();
      await transactionsService.create({
        name: name.trim(),
        type: 'gasto',
        amount: -Math.abs(parseFloat(amount)),
        category,
        categoryIcon,
        accountId: accounts[0]?.id || '',
        account: accounts[0]?.name || '',
        notes,
        date,
        time: new Date().toTimeString().slice(0, 5),
      });
      onSuccess();
    } catch { setError('Error al guardar.'); } finally { setSaving(false); }
  };

  return (
    <FormWrapper title="Nuevo Gasto" emoji="🧾" accentBg="bg-[#fde899]" onClose={onClose}>
      <FormFields
        name={name} setName={setName}
        amount={amount} setAmount={setAmount}
        date={date} setDate={setDate}
        notes={notes} setNotes={setNotes}
        categories={EXPENSE_CATEGORIES} category={category} onCategoryChange={handleCat}
        error={error} saving={saving} onSave={handleSave}
        saveLabel="Registrar gasto"
        saveBg="bg-[#F5C518] text-black"
      />
    </FormWrapper>
  );
}

function IngresoForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Salario');
  const [categoryIcon, setCategoryIcon] = useState('💼');
  const [collectionDate, setCollectionDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'pendiente' | 'cobrado'>('cobrado');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCat = (label: string) => {
    const c = INCOME_CATEGORIES.find(x => x.label === label);
    setCategory(label);
    setCategoryIcon(c?.icon || '💰');
  };

  const handleSave = async () => {
    if (!name.trim() || !amount) { setError('Completa nombre y monto.'); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('No autenticado.'); setSaving(false); return; }
      const entryDate = collectionDate || new Date().toISOString().split('T')[0];
      const { data, error: dbErr } = await supabase.from('income_entries').insert({
        user_id: user.id,
        name: name.trim(),
        amount: parseFloat(amount),
        category,
        category_icon: categoryIcon,
        collection_date: entryDate,
        notes,
        status,
      }).select().single();
      if (dbErr) throw dbErr;
      if (status === 'cobrado' && data) {
        await supabase.from('transactions').insert({
          user_id: user.id,
          name: name.trim(),
          category,
          category_icon: categoryIcon,
          account_name: 'Ingresos',
          amount: Math.abs(parseFloat(amount)),
          transaction_date: entryDate,
          transaction_time: new Date().toTimeString().slice(0, 5),
          transaction_type: 'ingreso',
          notes,
        });
      }
      onSuccess();
    } catch { setError('Error al guardar.'); } finally { setSaving(false); }
  };

  return (
    <FormWrapper title="Nuevo Ingreso" emoji="➕" accentBg="bg-[#e1c2fd]" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nombre</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Sueldo enero"
            className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-purple-400 bg-white" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Monto (S/)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
            className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-purple-400 bg-white" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Estado</label>
          <div className="mt-1 flex gap-2">
            {(['cobrado', 'pendiente'] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all ${status === s ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-500'}`}>
                {s === 'cobrado' ? '✅ Cobrado' : '⏳ Por cobrar'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fecha de cobro</label>
          <input type="date" value={collectionDate} onChange={e => setCollectionDate(e.target.value)}
            className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-purple-400 bg-white" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Categoría</label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {INCOME_CATEGORIES.map(c => (
              <button key={c.label} onClick={() => handleCat(c.label)}
                className={`px-2.5 py-1 rounded-lg border-2 text-xs font-semibold transition-all ${category === c.label ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-600'}`}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Notas</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional"
            className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-purple-400 bg-white" />
        </div>
        {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 rounded-xl border-2 border-black bg-[#C084FC] text-black font-black text-sm shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-0.5 transition-all disabled:opacity-50">
          {saving ? 'Guardando…' : 'Registrar ingreso'}
        </button>
      </div>
    </FormWrapper>
  );
}

function PagoForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Servicios');
  const [categoryIcon, setCategoryIcon] = useState('💡');
  const [paymentDate, setPaymentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'pendiente' | 'pagado'>('pendiente');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCat = (label: string) => {
    const c = PAGO_CATEGORIES.find(x => x.label === label);
    setCategory(label);
    setCategoryIcon(c?.icon || '📦');
  };

  const handleSave = async () => {
    if (!name.trim() || !amount) { setError('Completa nombre y monto.'); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('No autenticado.'); setSaving(false); return; }
      const pDate = paymentDate || new Date().toISOString().split('T')[0];
      const paymentDay = new Date(pDate + 'T00:00:00').getDate();
      await supabase.from('pagos').insert({
        user_id: user.id,
        name: name.trim(),
        amount: parseFloat(amount),
        category,
        category_icon: categoryIcon,
        payment_date: pDate,
        notes,
        status,
        is_recurring: false,
        payment_day: paymentDay,
      });
      if (status === 'pagado') {
        await supabase.from('transactions').insert({
          user_id: user.id,
          name: name.trim(),
          category,
          category_icon: categoryIcon,
          account_name: 'Pagos',
          amount: -Math.abs(parseFloat(amount)),
          transaction_date: pDate,
          transaction_time: new Date().toTimeString().slice(0, 5),
          transaction_type: 'gasto',
          notes,
        });
      }
      onSuccess();
    } catch { setError('Error al guardar.'); } finally { setSaving(false); }
  };

  return (
    <FormWrapper title="Nuevo Pago" emoji="📅" accentBg="bg-[#ffd5cc]" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nombre</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Alquiler"
            className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-red-400 bg-white" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Monto (S/)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
            className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-red-400 bg-white" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Estado</label>
          <div className="mt-1 flex gap-2">
            {(['pendiente', 'pagado'] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all ${status === s ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-500'}`}>
                {s === 'pagado' ? '✅ Pagado' : '⏳ Pendiente'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fecha de pago</label>
          <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
            className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-red-400 bg-white" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Categoría</label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {PAGO_CATEGORIES.map(c => (
              <button key={c.label} onClick={() => handleCat(c.label)}
                className={`px-2.5 py-1 rounded-lg border-2 text-xs font-semibold transition-all ${category === c.label ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-600'}`}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Notas</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional"
            className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-red-400 bg-white" />
        </div>
        {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 rounded-xl border-2 border-black bg-[#F87171] text-black font-black text-sm shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-0.5 transition-all disabled:opacity-50">
          {saving ? 'Guardando…' : 'Registrar pago'}
        </button>
      </div>
    </FormWrapper>
  );
}

function SuscripcionForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [nextPaymentDate, setNextPaymentDate] = useState('');
  const [icon, setIcon] = useState('🎬');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !amount || !nextPaymentDate) { setError('Completa nombre, monto y fecha.'); return; }
    setSaving(true);
    try {
      const paymentDay = new Date(nextPaymentDate + 'T00:00:00').getDate();
      await subscriptionsService.create({
        name: name.trim(),
        category: 'Entretenimiento',
        amount: parseFloat(amount),
        nextDate: nextPaymentDate,
        nextPaymentDate,
        paymentDay,
        paymentStatus: 'pending',
        active: true,
        icon,
        color: '#7C3AED',
      });
      onSuccess();
    } catch { setError('Error al guardar.'); } finally { setSaving(false); }
  };

  return (
    <FormWrapper title="Nueva Suscripción" emoji="📺" accentBg="bg-[#bfdbfe]" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nombre</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Netflix"
            className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-blue-400 bg-white" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Monto mensual (S/)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
            className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-blue-400 bg-white" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Próximo pago</label>
          <input type="date" value={nextPaymentDate} onChange={e => setNextPaymentDate(e.target.value)}
            className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-blue-400 bg-white" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Ícono</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {['🎬', '🎵', '📡', '☁️', '📱', '🎮', '📚', '🔄'].map(ic => (
              <button key={ic} onClick={() => setIcon(ic)}
                className={`w-9 h-9 rounded-xl border-2 text-lg transition-all ${icon === ic ? 'border-black bg-black' : 'border-gray-200'}`}>
                {ic}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 rounded-xl border-2 border-black bg-[#3B82F6] text-white font-black text-sm shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-0.5 transition-all disabled:opacity-50">
          {saving ? 'Guardando…' : 'Registrar suscripción'}
        </button>
      </div>
    </FormWrapper>
  );
}

function TransferenciaForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !amount) { setError('Completa nombre y monto.'); return; }
    setSaving(true);
    try {
      const accounts = await accountsService.getAll();
      await transactionsService.create({
        name: name.trim(),
        type: 'transferencia',
        amount: -Math.abs(parseFloat(amount)),
        category: 'Transferencia',
        categoryIcon: '⇄',
        accountId: accounts[0]?.id || '',
        account: accounts[0]?.name || '',
        notes,
        date,
        time: new Date().toTimeString().slice(0, 5),
      });
      onSuccess();
    } catch { setError('Error al guardar.'); } finally { setSaving(false); }
  };

  return (
    <FormWrapper title="Nueva Transferencia" emoji="⇄" accentBg="bg-[#fe9a82]" onClose={onClose}>
      <FormFields
        name={name} setName={setName}
        amount={amount} setAmount={setAmount}
        date={date} setDate={setDate}
        notes={notes} setNotes={setNotes}
        categories={[]}
        category="" onCategoryChange={() => {}}
        error={error} saving={saving} onSave={handleSave}
        saveLabel="Registrar transferencia"
        saveBg="bg-[#F97316] text-white"
        hideCategories
      />
    </FormWrapper>
  );
}

function AhorroForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('0');
  const [icon, setIcon] = useState('🐷');
  const [targetDate, setTargetDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !target) { setError('Completa nombre y meta.'); return; }
    setSaving(true);
    try {
      await savingsService.create({
        name: name.trim(),
        icon,
        current: parseFloat(current) || 0,
        target: parseFloat(target),
        color: '#16A34A',
        targetDate,
      });
      onSuccess();
    } catch { setError('Error al guardar.'); } finally { setSaving(false); }
  };

  return (
    <FormWrapper title="Nueva Meta de Ahorro" emoji="🐷" accentBg="bg-[#BBF7D0]" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nombre de la meta</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Fondo de emergencia"
            className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-green-400 bg-white" />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Meta (S/)</label>
            <input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="0.00"
              className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-green-400 bg-white" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Ya tengo (S/)</label>
            <input type="number" value={current} onChange={e => setCurrent(e.target.value)} placeholder="0.00"
              className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-green-400 bg-white" />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fecha objetivo</label>
          <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
            className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-green-400 bg-white" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Ícono</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {GOAL_ICONS.map(ic => (
              <button key={ic} onClick={() => setIcon(ic)}
                className={`w-9 h-9 rounded-xl border-2 text-lg transition-all ${icon === ic ? 'border-black bg-black' : 'border-gray-200'}`}>
                {ic}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 rounded-xl border-2 border-black bg-[#22C55E] text-black font-black text-sm shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-0.5 transition-all disabled:opacity-50">
          {saving ? 'Guardando…' : 'Crear meta de ahorro'}
        </button>
      </div>
    </FormWrapper>
  );
}

// ── Shared sub-components ───────────────────────────────────────────────────

function FormWrapper({ title, emoji, accentBg, onClose, children }: {
  title: string; emoji: string; accentBg: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="px-4 pb-8">
      {/* back button */}
      <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 mb-4 hover:text-black transition-colors">
        <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
        Volver
      </button>
      {/* form header */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-black mb-5 ${accentBg}`}>
        <span className="text-2xl">{emoji}</span>
        <h3 className="text-lg font-black text-black">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function FormFields({ name, setName, amount, setAmount, date, setDate, notes, setNotes,
  categories, category, onCategoryChange, error, saving, onSave, saveLabel, saveBg, hideCategories }: {
  name: string; setName: (v: string) => void;
  amount: string; setAmount: (v: string) => void;
  date: string; setDate: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  categories: { label: string; icon: string }[];
  category: string; onCategoryChange: (v: string) => void;
  error: string; saving: boolean; onSave: () => void;
  saveLabel: string; saveBg: string;
  hideCategories?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nombre</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Almuerzo"
          className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-yellow-400 bg-white" />
      </div>
      <div>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Monto (S/)</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
          className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-yellow-400 bg-white" />
      </div>
      <div>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fecha</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-yellow-400 bg-white" />
      </div>
      {!hideCategories && categories.length > 0 && (
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Categoría</label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {categories.map(c => (
              <button key={c.label} onClick={() => onCategoryChange(c.label)}
                className={`px-2.5 py-1 rounded-lg border-2 text-xs font-semibold transition-all ${category === c.label ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-600'}`}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Notas</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional"
          className="mt-1 w-full px-3 py-2.5 border-2 border-black rounded-xl text-sm font-medium outline-none focus:border-yellow-400 bg-white" />
      </div>
      {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
      <button onClick={onSave} disabled={saving}
        className={`w-full py-3 rounded-xl border-2 border-black font-black text-sm shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-0.5 transition-all disabled:opacity-50 ${saveBg}`}>
        {saving ? 'Guardando…' : saveLabel}
      </button>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function MobileNav({ onFabClick }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeForm, setActiveForm] = useState<FormKey>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const isActive = (href: string) => {
    if (href === '/finanzas') return pathname === '/finanzas';
    return pathname.startsWith(href);
  };

  const moreActive = [
    '/finanzas/cuentas', '/finanzas/ahorros', '/finanzas/deudas',
    '/finanzas/inversiones', '/finanzas/suscripciones', '/finanzas/configuracion',
    '/finanzas/patrimonio', '/finanzas/reportes', '/finanzas/calendario',
    '/finanzas/ingresos', '/finanzas/pagos', '/finanzas/juntas',
  ].some((h) => pathname.startsWith(h));

  async function handleSignOut() {
    try { await signOut(); router.replace('/login'); } catch {}
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
                    ? 'bg-[#FFD43B] text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' :'bg-[#FFD43B] text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                }`}
              >
                <Users className="w-[18px] h-[18px] flex-shrink-0 text-black" strokeWidth={2.5} />
                <div className="flex-1 min-w-0">
                  <div className="font-black text-black text-sm leading-tight">Juntas</div>
                  <div className="text-[10px] font-medium text-black/70 leading-tight">Ahorra en grupo</div>
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
        <div
          className="lg:hidden fixed inset-0 z-50 flex items-end"
          onClick={handleSheetClose}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full bg-[#F5F0E8] rounded-t-3xl border-t-2 border-black max-h-[92vh] overflow-y-auto"
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
                  <h2 className="text-2xl font-black text-black leading-tight">¿Qué quieres<br />registrar?</h2>
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
                            <img
                              src={opt.image}
                              alt={opt.label}
                              className="absolute inset-0 w-full h-full object-cover object-center"
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
            {activeForm === 'gasto' && <GastoForm onClose={handleFormClose} onSuccess={handleFormSuccess} />}
            {activeForm === 'ingreso' && <IngresoForm onClose={handleFormClose} onSuccess={handleFormSuccess} />}
            {activeForm === 'pago' && <PagoForm onClose={handleFormClose} onSuccess={handleFormSuccess} />}
            {activeForm === 'suscripcion' && <SuscripcionForm onClose={handleFormClose} onSuccess={handleFormSuccess} />}
            {activeForm === 'transferencia' && <TransferenciaForm onClose={handleFormClose} onSuccess={handleFormSuccess} />}
            {activeForm === 'ahorro' && <AhorroForm onClose={handleFormClose} onSuccess={handleFormSuccess} />}
          </div>
        </div>
      )}

      {/* ── Bottom Nav Bar ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-black border-t border-gray-800">
        <div className="flex items-center justify-around px-2 pt-2 pb-4 relative max-w-lg mx-auto">

          {/* Inicio */}
          <Link href="/finanzas" className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px]">
            <Home className={`w-6 h-6 ${isActive('/finanzas') ? 'text-[#FFD93D]' : 'text-gray-400'}`} strokeWidth={2} />
            <span className={`text-[10px] font-bold ${isActive('/finanzas') ? 'text-[#FFD93D]' : 'text-gray-400'}`}>Inicio</span>
          </Link>

          {/* Movimientos */}
          <Link href="/finanzas/movimientos" className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px]">
            <svg className={`w-6 h-6 ${isActive('/finanzas/movimientos') ? 'text-[#FFD93D]' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
            </svg>
            <span className={`text-[10px] font-bold ${isActive('/finanzas/movimientos') ? 'text-[#FFD93D]' : 'text-gray-400'}`}>Movimientos</span>
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

          {/* Cuentas */}
          <Link href="/finanzas/cuentas" className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px]">
            <svg className={`w-6 h-6 ${isActive('/finanzas/cuentas') ? 'text-[#FFD93D]' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span className={`text-[10px] font-bold ${isActive('/finanzas/cuentas') ? 'text-[#FFD93D]' : 'text-gray-400'}`}>Cuentas</span>
          </Link>

          {/* Más */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px]"
          >
            <svg className={`w-6 h-6 ${moreActive ? 'text-[#FFD93D]' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span className={`text-[10px] font-bold ${moreActive ? 'text-[#FFD93D]' : 'text-gray-400'}`}>Más</span>
          </button>

        </div>
      </nav>
    </>
  );
}
