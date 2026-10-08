'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRightLeft, ChevronLeft, Loader2, Plus } from 'lucide-react';
import LoadError from '@/components/ui/LoadError';
import { GlyphTile } from '@/components/ui/Glyph';
import { useToast } from '@/components/ui/Toast';
import ContextSwitch from '@/components/business/ContextSwitch';
import BusinessEntrySheet, {
  type BusinessEntryMode,
} from '@/components/business/BusinessEntrySheet';
import { negocioChanged, useNegocio } from '@/components/business/useNegocio';
import { card } from '@/components/dashboard/ui';
import { CURRENCIES } from '@/lib/currency';
import { formatMoney } from '@/lib/format';
import { parseAmountInput } from '@/lib/amount';
import { rememberBusiness, BUSINESS_KINDS } from '@/lib/business';
import { businessService } from '@/lib/supabaseBusiness';
import { userSettingsService } from '@/lib/supabaseCurrency';
import { useDataChanged } from '@/lib/dataSync';
import type { Account } from '@/lib/financeStore';

// Accounts of a business (the account defines the context: every movement in them is the
// business's) and the business settings.

const TYPES: { value: Account['type']; label: string; icon: string }[] = [
  { value: 'banco', label: 'Banco', icon: 'bank' },
  { value: 'efectivo', label: 'Caja / efectivo', icon: 'cash' },
  { value: 'digital', label: 'Billetera digital', icon: 'phone' },
  { value: 'credito', label: 'Tarjeta de crédito', icon: 'card' },
];

const field =
  'w-full rounded-xl border-2 border-[#111] bg-white px-3 py-2.5 text-sm font-semibold text-[#111] outline-none focus-visible:ring-2 focus-visible:ring-[#75B8FF]';
const label = 'mb-1 block text-xs font-black uppercase tracking-wide text-[#111]/70';

export default function BusinessAccountsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { businesses } = useNegocio();
  const business = businesses.find((b) => b.id === id);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [cash, setCash] = useState<{ amount: number; currency: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [adding, setAdding] = useState(false);
  const [entry, setEntry] = useState<BusinessEntryMode | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'banco' as Account['type'],
    currency: 'PEN',
    balance: '',
  });
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<{ name: string; kind: string | null } | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([businessService.accounts(id), businessService.summary(id)])
      .then(([a, s]) => {
        setAccounts(a);
        setCash({ amount: s.cash, currency: s.currency });
      })
      .catch(setError);
  }, [id]);
  useEffect(load, [load]);
  useDataChanged(load);
  useEffect(() => {
    userSettingsService
      .get()
      .then((s) => setForm((f) => ({ ...f, currency: s.baseCurrencyCode })))
      .catch(() => {});
  }, []);

  const addAccount = async () => {
    if (!form.name.trim()) return toast.showError(new Error('Escribe un nombre para la cuenta.'));
    const initial = form.balance.trim() ? parseAmountInput(form.balance) : 0;
    if (!Number.isFinite(initial)) return toast.showError(new Error('Revisa el saldo inicial.'));
    setSaving(true);
    try {
      const t = TYPES.find((x) => x.value === form.type)!;
      await businessService.createAccount(id, {
        name: form.name.trim(),
        type: form.type,
        institution: '',
        balance: initial,
        currency: form.currency,
        icon: t.icon,
        color: '#111111',
        bgColor: '#FFF9EC',
      });
      setAdding(false);
      setForm((f) => ({ ...f, name: '', balance: '' }));
      load();
      toast.showSuccess('Cuenta agregada.');
    } catch (e) {
      toast.showError(e);
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    if (!settings?.name.trim()) return;
    try {
      await businessService.rename(id, settings.name, settings.kind);
      negocioChanged();
      setSettings(null);
      toast.showSuccess('Negocio actualizado.');
    } catch (e) {
      toast.showError(e);
    }
  };

  const remove = async () => {
    if (
      !window.confirm(
        `¿Eliminar «${business?.name ?? 'este negocio'}»? Solo se puede si no tiene cuentas.`
      )
    )
      return;
    try {
      await businessService.remove(id);
      rememberBusiness(null);
      negocioChanged();
      router.replace('/finanzas');
    } catch (e) {
      toast.showError(e);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <LoadError what="las cuentas del negocio" error={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-5 text-[#111] lg:px-8 lg:py-6">
      <ContextSwitch className="mb-4 lg:hidden" />
      <Link
        href={`/finanzas/negocio/${id}`}
        className="mb-3 inline-flex items-center gap-1 text-sm font-black"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.8} /> {business?.name ?? 'Negocio'}
      </Link>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-black leading-tight">Cuentas del negocio</h1>
          <p className="text-sm font-semibold text-[#111]/70">
            Lo que se mueve en estas cuentas es del negocio y no aparece en tus finanzas personales.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="paper-opaque inline-flex items-center gap-1.5 rounded-xl border-2 border-[#111] bg-[#FFD83D] px-3 py-2 text-sm font-black shadow-[0_3px_0_#111]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Agregar cuenta
        </button>
      </div>

      {adding && (
        <div className={`${card} mb-4 space-y-3 p-5`}>
          <label className="block">
            <span className={label}>Nombre</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej. BCP Negocio"
              className={field}
            />
          </label>
          <div>
            <span className={label}>Tipo</span>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={form.type === t.value}
                  onClick={() => setForm({ ...form, type: t.value })}
                  className={`flex items-center gap-2 rounded-xl border-2 border-[#111] px-3 py-2 text-left text-sm font-bold ${
                    form.type === t.value ? 'paper-opaque bg-[#FFD83D]' : 'bg-white'
                  }`}
                >
                  <GlyphTile name={t.icon} size="sm" color="#FFFFFF" /> {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={label}>Moneda</span>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className={field}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={label}>Saldo actual</span>
              <input
                inputMode="decimal"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
                placeholder="0.00"
                className={field}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={addAccount}
            disabled={saving}
            className="paper-opaque flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#111] py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar cuenta
          </button>
        </div>
      )}

      {!accounts ? (
        <div className="h-32 animate-pulse rounded-[22px] border-2 border-[#111]/20 bg-white" />
      ) : accounts.length === 0 ? (
        <p className={`${card} p-5 text-sm font-bold`}>
          Todavía no hay cuentas en este negocio. Agrega la cuenta bancaria, la caja o la billetera
          que usa tu negocio.
        </p>
      ) : (
        <>
          <div className={`${card} mb-4 flex items-center justify-between p-5`}>
            <div>
              <p className="text-sm font-black">Total disponible</p>
              <p className="text-[28px] font-black tabular-nums">
                {cash ? formatMoney(cash.amount, cash.currency) : ' '}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEntry('retiro')}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#111] bg-white px-3 py-2 text-xs font-black"
            >
              <ArrowRightLeft className="h-4 w-4" strokeWidth={2.5} /> Retiro o aporte
            </button>
          </div>
          <ul className="space-y-2">
            {accounts.map((a) => (
              <li key={a.id} className={`${card} flex items-center gap-3 p-4`}>
                <GlyphTile name={a.icon} fallback="bank" color="#FFF9EC" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black">{a.name}</p>
                  <p className="text-xs font-semibold text-[#111]/60">
                    {TYPES.find((t) => t.value === a.type)?.label ?? a.type} · {a.currency}
                  </p>
                </div>
                <p className="font-black tabular-nums">{formatMoney(a.balance, a.currency)}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      <section className={`${card} mt-6 p-5`}>
        <p className="text-sm font-black">Ajustes del negocio</p>
        {settings ? (
          <div className="mt-3 space-y-3">
            <input
              value={settings.name}
              maxLength={60}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              className={field}
            />
            <select
              value={settings.kind ?? ''}
              onChange={(e) => setSettings({ ...settings, kind: e.target.value || null })}
              className={field}
            >
              <option value="">Sin rubro</option>
              {BUSINESS_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSettings(null)}
                className="flex-1 rounded-xl border-2 border-[#111] bg-white py-2 text-sm font-black"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveSettings}
                className="paper-opaque flex-1 rounded-xl border-2 border-[#111] bg-[#FFD83D] py-2 text-sm font-black"
              >
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setSettings({ name: business?.name ?? '', kind: business?.kind ?? null })
              }
              className="rounded-xl border-2 border-[#111] bg-white px-3 py-2 text-sm font-black"
            >
              Cambiar nombre o rubro
            </button>
            <button
              type="button"
              onClick={remove}
              className="rounded-xl border-2 border-[#B42318] bg-white px-3 py-2 text-sm font-black text-[#B42318]"
            >
              Eliminar negocio
            </button>
          </div>
        )}
      </section>

      {entry && (
        <BusinessEntrySheet
          businessId={id}
          mode={entry}
          onClose={() => setEntry(null)}
          onSaved={() => {
            setEntry(null);
            load();
          }}
        />
      )}
    </div>
  );
}
