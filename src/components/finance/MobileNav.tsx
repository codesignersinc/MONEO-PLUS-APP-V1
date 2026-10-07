'use client';
import React, { useEffect, useState } from 'react';
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
  ChevronLeft,
  Users,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import MoneoLogo from '@/components/ui/MoneoLogo';
import { useAuth } from '@/contexts/AuthContext';
import {
  transactionsService,
  accountsService,
  subscriptionsService,
  savingsService,
} from '@/lib/supabaseFinance';
import Icon from '@/components/ui/AppIcon';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';
import { buildCurrencyFields, getRateFromMap } from '@/lib/currency';
import { getFxContext } from '@/lib/supabaseCurrency';
import { localDateTimeToISO, nowTimeLocal, todayLocal } from '@/lib/dates';
import {
  AccountSelect,
  AmountField,
  CategoryChips,
  DateField,
  FIELD,
  FormHero,
  NotesField,
  SubmitButton,
  TextField,
} from '@/components/finance/formKit';
import TransferForm from '@/components/finance/TransferForm';
import {
  EntryMethodPicker,
  ImageReader,
  VoiceReader,
  type EntryMethod,
  type Prefill,
} from '@/components/finance/ExpenseEntry';
import { usePlus } from '@/contexts/PlusContext';
import {
  AccountAmountFields,
  EMPTY_ACCOUNT_CHOICE,
  resolveAccountChoice,
  type AccountChoice,
} from '@/components/finance/AccountAmountPicker';
import { incomeService, pagosService } from '@/lib/supabaseObligations';
import type { Account } from '@/lib/financeStore';
import { notifyDataChanged } from '@/lib/dataSync';

interface MobileNavProps {
  onFabClick: () => void;
}

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

// Maps the interpreter's category (CATEGORY_PRESETS labels) to the quick-add expense ones.
const EXPENSE_CATEGORY_ALIASES: Record<string, string> = {
  Supermercado: 'Comida',
  Vivienda: 'Hogar',
  Servicios: 'Hogar',
  Suscripciones: 'Entretenimiento',
  Otros: 'Otro',
};

function GastoForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const router = useRouter();
  const { plus } = usePlus();
  // First "¿Cómo quieres ingresar el gasto?", then the form (pre-filled when read).
  const [mode, setMode] = useState<'choose' | EntryMethod>('choose');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Comida');
  const [categoryIcon, setCategoryIcon] = useState('🍽️');
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [accountId, setAccountId] = useState('');

  useEffect(() => {
    accountsService
      .getAll()
      .then((accs) => {
        setAccounts(accs);
        // First registered account preselected; the user can change it.
        setAccountId((cur) => cur || accs[0]?.id || '');
      })
      .catch((err) => {
        console.error(err);
        setAccounts([]);
        setError(getErrorMessage(err));
      });
  }, []);

  const handleCat = (label: string) => {
    const c = EXPENSE_CATEGORIES.find((x) => x.label === label);
    setCategory(label);
    setCategoryIcon(c?.icon || '📦');
  };

  const handleSave = async () => {
    if (!name.trim() || !amount) {
      setError('Completa nombre y monto.');
      return;
    }
    const account = accounts?.find((a) => a.id === accountId);
    if (!account) {
      setError('Elige la cuenta de la que sale el gasto.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const fx = await getFxContext();
      const accCurrency = account.currency || 'PEN';
      const amt = -Math.abs(parseFloat(amount));
      await transactionsService.create({
        name: name.trim(),
        type: 'gasto',
        amount: amt,
        category,
        categoryIcon,
        accountId: account.id,
        account: account.name,
        notes,
        date: localDateTimeToISO(date, nowTimeLocal()),
        time: nowTimeLocal(),
        ...buildCurrencyFields({
          amount: amt,
          currency: accCurrency,
          baseCurrency: fx.baseCurrency,
          rateToBase: getRateFromMap(fx.ratesMap, accCurrency, fx.baseCurrency),
          date,
        }),
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const applyPrefill = (p: Prefill | null, heard?: string) => {
    if (p) {
      if (p.name) setName(p.name.slice(0, 80));
      if (p.amount) setAmount(p.amount);
      if (p.date) setDate(p.date);
      const label = p.category ? (EXPENSE_CATEGORY_ALIASES[p.category] ?? p.category) : null;
      if (label && EXPENSE_CATEGORIES.some((c) => c.label === label)) handleCat(label);
      setNotice('Revisa los datos detectados, elige la cuenta y registra.');
    } else {
      if (heard) setName(heard.slice(0, 80));
      setNotice('No encontramos el monto. Complétalo a mano.');
    }
    setMode('manual');
  };

  if (mode === 'choose') {
    return (
      <EntryMethodPicker
        plus={plus}
        onBack={onClose}
        onPick={(m) => {
          setNotice('');
          setMode(m);
        }}
        onLocked={() => router.push('/finanzas/plus')}
      />
    );
  }
  if (mode === 'scan' || mode === 'image') {
    return (
      <ImageReader
        camera={mode === 'scan'}
        onDone={(p) => applyPrefill(p)}
        onCancel={() => setMode('choose')}
      />
    );
  }
  if (mode === 'voice') {
    return <VoiceReader onDone={applyPrefill} onCancel={() => setMode('choose')} />;
  }

  return (
    <FormWrapper
      title="Nuevo Gasto"
      emoji="🧾"
      accentBg="bg-[#fde899]"
      onClose={() => setMode('choose')}
    >
      {notice && (
        <p className="mb-4 rounded-2xl border-2 border-[#111] bg-[#DDF7E9] px-3 py-2 text-sm font-bold text-[#111]">
          {notice}
        </p>
      )}
      <div className="mb-5">
        <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
      </div>
      <FormFields
        name={name}
        setName={setName}
        amount={amount}
        setAmount={setAmount}
        date={date}
        setDate={setDate}
        notes={notes}
        setNotes={setNotes}
        categories={EXPENSE_CATEGORIES}
        category={category}
        onCategoryChange={handleCat}
        error={error}
        saving={saving}
        onSave={handleSave}
        saveLabel="Registrar gasto"
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
  const [choice, setChoice] = useState<AccountChoice>(EMPTY_ACCOUNT_CHOICE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const handleCat = (label: string) => {
    const c = INCOME_CATEGORIES.find((x) => x.label === label);
    setCategory(label);
    setCategoryIcon(c?.icon || '💰');
  };

  const handleSave = async () => {
    if (!name.trim() || !amount) {
      setError('Completa nombre y monto.');
      return;
    }
    const account = status === 'cobrado' ? resolveAccountChoice(choice) : null;
    if (account && 'error' in account) {
      setError(account.error);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const entry = await incomeService.create({
        name: name.trim(),
        amount: parseFloat(amount),
        category,
        categoryIcon,
        collectionDate: collectionDate || todayLocal(),
        notes,
      });
      if (account) {
        try {
          await incomeService.markCollected(entry.id, account.accountId, account.accountAmount);
        } catch (err) {
          // The entry is saved as pending: retrying the form would duplicate it.
          console.error(err);
          toast.showError('El ingreso se guardó como pendiente: no se pudo marcar como cobrado.');
        }
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormWrapper title="Nuevo Ingreso" emoji="➕" accentBg="bg-[#e1c2fd]" onClose={onClose}>
      <div className="space-y-5">
        <TextField label="Nombre" value={name} onChange={setName} placeholder="Ej. Sueldo enero" />
        <AmountField label="Monto (S/)" value={amount} onChange={setAmount} />
        <div>
          <span className="sr-only">Estado</span>
          <div className="flex gap-2">
            {(['cobrado', 'pendiente'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all ${status === s ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-500'}`}
              >
                {s === 'cobrado' ? '✅ Cobrado' : '⏳ Por cobrar'}
              </button>
            ))}
          </div>
        </div>
        {status === 'cobrado' && (
          <AccountAmountFields
            amount={parseFloat(amount) || 0}
            value={choice}
            onChange={setChoice}
            label="Cuenta donde cobraste"
            selectClassName={FIELD}
          />
        )}
        <DateField label="Fecha de cobro" value={collectionDate} onChange={setCollectionDate} />
        <CategoryChips categories={INCOME_CATEGORIES} value={category} onChange={handleCat} />
        <NotesField value={notes} onChange={setNotes} />
        {error && (
          <p className="rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]">
            {error}
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex h-16 w-full items-center justify-center rounded-2xl border-[3px] border-[#111] bg-[#C084FC] text-black text-[19px] font-black shadow-[0_5px_0_#111] transition-transform active:translate-y-1 active:shadow-[0_1px_0_#111] disabled:opacity-60"
        >
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
  const [choice, setChoice] = useState<AccountChoice>(EMPTY_ACCOUNT_CHOICE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const handleCat = (label: string) => {
    const c = PAGO_CATEGORIES.find((x) => x.label === label);
    setCategory(label);
    setCategoryIcon(c?.icon || '📦');
  };

  const handleSave = async () => {
    if (!name.trim() || !amount) {
      setError('Completa nombre y monto.');
      return;
    }
    const account = status === 'pagado' ? resolveAccountChoice(choice) : null;
    if (account && 'error' in account) {
      setError(account.error);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const pDate = paymentDate || todayLocal();
      const pago = await pagosService.create({
        name: name.trim(),
        amount: parseFloat(amount),
        category,
        categoryIcon,
        paymentDate: pDate,
        notes,
        isRecurring: false,
        paymentDay: new Date(pDate + 'T00:00:00').getDate(),
      });
      if (account) {
        try {
          await pagosService.markPaid(pago.id, account.accountId, account.accountAmount);
        } catch (err) {
          // The payment is saved as pending: retrying the form would duplicate it.
          console.error(err);
          toast.showError('El pago se guardó como pendiente: no se pudo marcar como pagado.');
        }
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormWrapper title="Nuevo Pago" emoji="📅" accentBg="bg-[#ffd5cc]" onClose={onClose}>
      <div className="space-y-5">
        <TextField label="Nombre" value={name} onChange={setName} placeholder="Ej. Alquiler" />
        <AmountField label="Monto (S/)" value={amount} onChange={setAmount} />
        <div>
          <span className="sr-only">Estado</span>
          <div className="flex gap-2">
            {(['pendiente', 'pagado'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all ${status === s ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-500'}`}
              >
                {s === 'pagado' ? '✅ Pagado' : '⏳ Pendiente'}
              </button>
            ))}
          </div>
        </div>
        {status === 'pagado' && (
          <AccountAmountFields
            amount={parseFloat(amount) || 0}
            value={choice}
            onChange={setChoice}
            label="Cuenta desde la que pagaste"
            selectClassName={FIELD}
          />
        )}
        <DateField label="Fecha de pago" value={paymentDate} onChange={setPaymentDate} />
        <CategoryChips categories={PAGO_CATEGORIES} value={category} onChange={handleCat} />
        <NotesField value={notes} onChange={setNotes} />
        {error && (
          <p className="rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]">
            {error}
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex h-16 w-full items-center justify-center rounded-2xl border-[3px] border-[#111] bg-[#F87171] text-black text-[19px] font-black shadow-[0_5px_0_#111] transition-transform active:translate-y-1 active:shadow-[0_1px_0_#111] disabled:opacity-60"
        >
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
    if (!name.trim() || !amount || !nextPaymentDate) {
      setError('Completa nombre, monto y fecha.');
      return;
    }
    setSaving(true);
    setError('');
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
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormWrapper title="Nueva Suscripción" emoji="📺" accentBg="bg-[#bfdbfe]" onClose={onClose}>
      <div className="space-y-5">
        <TextField label="Nombre" value={name} onChange={setName} placeholder="Ej. Netflix" />
        <AmountField label="Monto mensual (S/)" value={amount} onChange={setAmount} />
        <DateField label="Próximo pago" value={nextPaymentDate} onChange={setNextPaymentDate} />
        <div>
          <span className="sr-only">Ícono</span>
          <div className="flex flex-wrap gap-2">
            {['🎬', '🎵', '📡', '☁️', '📱', '🎮', '📚', '🔄'].map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                className={`w-9 h-9 rounded-xl border-2 text-lg transition-all ${icon === ic ? 'border-black bg-black' : 'border-gray-200'}`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p className="rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]">
            {error}
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex h-16 w-full items-center justify-center rounded-2xl border-[3px] border-[#111] bg-[#3B82F6] text-white text-[19px] font-black shadow-[0_5px_0_#111] transition-transform active:translate-y-1 active:shadow-[0_1px_0_#111] disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Registrar suscripción'}
        </button>
      </div>
    </FormWrapper>
  );
}

function TransferenciaForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  return (
    <FormWrapper title="Nueva Transferencia" emoji="⇄" accentBg="bg-[#fe9a82]" onClose={onClose}>
      <TransferForm
        onSaved={onSuccess}
        saveClassName="bg-[#F97316] text-white border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)]"
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
    if (!name.trim() || !target) {
      setError('Completa nombre y meta.');
      return;
    }
    setSaving(true);
    setError('');
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
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormWrapper title="Nueva Meta de Ahorro" emoji="🐷" accentBg="bg-[#BBF7D0]" onClose={onClose}>
      <div className="space-y-5">
        <TextField
          label="Nombre de la meta"
          value={name}
          onChange={setName}
          placeholder="Ej. Fondo de emergencia"
        />
        <div className="flex gap-2">
          <div className="flex-1">
            <AmountField label="Meta (S/)" value={target} onChange={setTarget} />
          </div>
          <div className="flex-1">
            <AmountField label="Ya tengo (S/)" value={current} onChange={setCurrent} />
          </div>
        </div>
        <DateField label="Fecha objetivo" value={targetDate} onChange={setTargetDate} />
        <div>
          <span className="sr-only">Ícono</span>
          <div className="flex flex-wrap gap-2">
            {GOAL_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                className={`w-9 h-9 rounded-xl border-2 text-lg transition-all ${icon === ic ? 'border-black bg-black' : 'border-gray-200'}`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p className="rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]">
            {error}
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex h-16 w-full items-center justify-center rounded-2xl border-[3px] border-[#111] bg-[#22C55E] text-black text-[19px] font-black shadow-[0_5px_0_#111] transition-transform active:translate-y-1 active:shadow-[0_1px_0_#111] disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Crear meta de ahorro'}
        </button>
      </div>
    </FormWrapper>
  );
}

// ── Shared sub-components ───────────────────────────────────────────────────

const FORM_SUBTITLES: Record<string, string> = {
  'Nuevo Gasto': 'Registra un gasto y mantén el control de tu dinero.',
  'Nuevo Ingreso': 'Anota lo que cobras o lo que te deben pagar.',
  'Nuevo Pago': 'Programa un pago y te avisamos antes.',
  'Nueva Suscripción': 'Ten a la vista tus cobros mensuales.',
  'Nueva Transferencia': 'Mueve dinero entre tus cuentas.',
  'Nueva Meta de Ahorro': 'Ponle nombre y fecha a lo que quieres lograr.',
};

function FormWrapper({
  title,
  emoji,
  accentBg,
  onClose,
  children,
}: {
  title: string;
  emoji: string;
  accentBg: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const tone = accentBg.match(/#[0-9a-fA-F]{6}/)?.[0] ?? '#FFD83D';
  return (
    <div className="px-4 pb-8">
      <button
        onClick={onClose}
        className="mb-4 flex items-center gap-1.5 text-[17px] font-black text-[#111]"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.8} />
        Volver
      </button>
      <FormHero
        title={title.charAt(0) + title.slice(1).toLowerCase()}
        subtitle={FORM_SUBTITLES[title] ?? ''}
        emoji={emoji}
        tone={tone}
      />
      {children}
    </div>
  );
}

function FormFields({
  name,
  setName,
  amount,
  setAmount,
  date,
  setDate,
  notes,
  setNotes,
  categories,
  category,
  onCategoryChange,
  error,
  saving,
  onSave,
  saveLabel,
  hideCategories,
}: {
  name: string;
  setName: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  categories: { label: string; icon: string }[];
  category: string;
  onCategoryChange: (v: string) => void;
  error: string;
  saving: boolean;
  onSave: () => void;
  saveLabel: string;
  hideCategories?: boolean;
}) {
  return (
    <div className="space-y-5">
      <TextField
        label="Nombre del gasto"
        value={name}
        onChange={setName}
        placeholder="Ej. Almuerzo"
        icon={categories.find((c) => c.label === category)?.icon}
      />
      <div className="grid grid-cols-2 gap-3">
        <AmountField label="Monto (S/)" value={amount} onChange={setAmount} />
        <DateField label="Fecha" value={date} onChange={setDate} />
      </div>
      {!hideCategories && categories.length > 0 && (
        <CategoryChips categories={categories} value={category} onChange={onCategoryChange} />
      )}
      <NotesField value={notes} onChange={setNotes} />
      {error && (
        <p className="rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]">
          {error}
        </p>
      )}
      <SubmitButton onClick={onSave} disabled={saving} tone="#FFD83D">
        {saving ? 'Guardando…' : saveLabel}
      </SubmitButton>
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
