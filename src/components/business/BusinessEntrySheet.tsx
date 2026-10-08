'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Camera, Check, Loader2, Sparkles } from 'lucide-react';
import Glyph from '@/components/ui/Glyph';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';
import { parseAmountInput } from '@/lib/amount';
import { buildCurrencyFields, buildTransferAmounts, getRateFromMap } from '@/lib/currency';
import { localDateTimeToISO, nowTimeLocal, todayLocal } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { notifyDataChanged } from '@/lib/dataSync';
import { BUSINESS_EXPENSE_CATEGORIES, BUSINESS_INCOME_CATEGORIES } from '@/lib/business';
import { parseBusinessText, receiptNumber, sameName } from '@/lib/businessText';
import {
  bizMovementsService,
  bizObligationsService,
  businessService,
  partiesService,
  type BizObligation,
  type Party,
} from '@/lib/supabaseBusiness';
import { accountsService, transfersService } from '@/lib/supabaseFinance';
import { getFxContext } from '@/lib/supabaseCurrency';
import type { Account } from '@/lib/financeStore';
import { PartyField, Sheet, field, label } from './kit';

// Register a business movement: income, expense, or move money between the business and
// your personal accounts (owner withdrawal / contribution: a transfer, never income or
// expense). The account picks the context; the database enforces it.
// Fase 3: a typed phrase ("Vega me pagó 5,000") or a receipt photo fill the form; nothing is
// saved without confirming, and a matching pending collection/payment is settled instead of
// counting the money twice.

export type BusinessEntryMode = 'ingreso' | 'gasto' | 'retiro' | 'aporte';

const TITLES: Record<BusinessEntryMode, string> = {
  ingreso: 'Nuevo ingreso del negocio',
  gasto: 'Nuevo gasto del negocio',
  retiro: 'Retiro del negocio',
  aporte: 'Aporte al negocio',
};

export default function BusinessEntrySheet({
  businessId,
  mode: initialMode,
  onClose,
  onSaved,
}: {
  businessId: string;
  mode: BusinessEntryMode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<BusinessEntryMode>(initialMode);
  const [bizAccounts, setBizAccounts] = useState<Account[] | null>(null);
  const [personal, setPersonal] = useState<Account[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [pending, setPending] = useState<BizObligation[]>([]);
  const [accountId, setAccountId] = useState('');
  const [personalId, setPersonalId] = useState('');
  const [phrase, setPhrase] = useState('');
  const [understood, setUnderstood] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [party, setParty] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState('');
  const [reading, setReading] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      businessService.accounts(businessId),
      accountsService.getAll(),
      partiesService.list(businessId),
      bizObligationsService.list(businessId),
    ])
      .then(([b, p, parts, obligations]) => {
        setBizAccounts(b);
        setPersonal(p);
        setParties(parts);
        setPending(obligations.filter((o) => !o.done));
        setAccountId((id) => id || b[0]?.id || '');
        setPersonalId((id) => id || p[0]?.id || '');
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [businessId]);

  const categories = mode === 'ingreso' ? BUSINESS_INCOME_CATEGORIES : BUSINESS_EXPENSE_CATEGORIES;
  useEffect(() => {
    setCategory((c) => (categories.some((x) => x.label === c) ? c : categories[0].label));
  }, [mode, categories]);

  const account = bizAccounts?.find((a) => a.id === accountId);
  const personalAccount = personal.find((a) => a.id === personalId);
  const isTransfer = mode === 'retiro' || mode === 'aporte';
  const value = useMemo(() => parseAmountInput(amount), [amount]);
  const partyKind = mode === 'ingreso' ? 'cliente' : 'proveedor';
  const knownParty = parties.find((p) => party.trim() && sameName(p.name, party));

  // A pending collection (income) or payment (expense) of that contact with the same amount:
  // settle it instead of recording the money a second time.
  const match = useMemo(() => {
    if (isTransfer || !knownParty || !(value > 0)) return null;
    const type = mode === 'ingreso' ? 'cobro' : 'pago';
    return (
      pending.find(
        (o) => o.type === type && o.partyId === knownParty.id && Math.abs(o.amount - value) < 0.005
      ) ?? null
    );
  }, [isTransfer, knownParty, value, mode, pending]);
  const otherPending =
    !match && knownParty
      ? pending.filter(
          (o) => o.partyId === knownParty.id && o.type === (mode === 'ingreso' ? 'cobro' : 'pago')
        )
      : [];

  const interpret = () => {
    const intent = parseBusinessText(phrase);
    if (!intent) {
      setUnderstood(null);
      setError('No entendí la frase. Prueba con «Vega me pagó 5,000» o «Pagué 850 a Makro».');
      return;
    }
    setError('');
    setMode(intent.kind);
    setAmount(String(intent.amount));
    if (intent.party) setParty(intent.party);
    setName(intent.concept ?? (intent.party ? intent.party : ''));
    setUnderstood(
      `${intent.kind === 'ingreso' ? 'Ingreso' : 'Gasto'} de ${formatMoney(intent.amount, account?.currency ?? 'PEN')}` +
        (intent.party
          ? ` · ${intent.kind === 'ingreso' ? 'cliente' : 'proveedor'}: ${intent.party}`
          : '')
    );
  };

  const readPhoto = async (file: File) => {
    setError('');
    setReading(0);
    try {
      const [{ readImageText }, { parseReceipt }] = await Promise.all([
        import('@/lib/ocr'),
        import('@/lib/auto/receipt'),
      ]);
      const text = await readImageText(
        file,
        (f) => setReading(f),
        (t) => !!parseReceipt(t, new Date())
      );
      const r = parseReceipt(text, new Date());
      if (!r) {
        setError('No pude leer el total del comprobante. Escríbelo a mano.');
        return;
      }
      setMode('gasto');
      setAmount(String(r.amount));
      setDate(r.date);
      // "MAKRO SUPERMAYORISTA S.A." → the supplier "Makro" when it already exists.
      const fold = (x: string) =>
        x
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
      const known = parties.find(
        (pt) => pt.kind === 'proveedor' && fold(r.merchant).includes(fold(pt.name))
      );
      setParty(known?.name ?? r.merchant);
      setName(known?.name ?? r.merchant);
      const number = receiptNumber(text);
      if (number) setNotes(`Comprobante ${number}`);
      setUnderstood(
        `Comprobante de ${r.merchant} por ${formatMoney(r.amount, r.currency)}. Revisa los datos.`
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setReading(null);
    }
  };

  const save = async () => {
    setError('');
    if (!account) return setError('Agrega primero una cuenta del negocio.');
    if (!(value > 0)) return setError('Escribe un monto mayor que cero.');
    if (isTransfer && !personalAccount) return setError('Necesitas una cuenta personal.');
    if (!isTransfer && !name.trim() && !party.trim()) return setError('Escribe una descripción.');
    setSaving(true);
    try {
      const fx = await getFxContext();
      if (isTransfer) {
        const from = mode === 'retiro' ? account : personalAccount!;
        const to = mode === 'retiro' ? personalAccount! : account;
        await transfersService.create({
          fromAccountId: from.id,
          toAccountId: to.id,
          ...buildTransferAmounts({
            fromAmount: value,
            fromCurrency: from.currency || 'PEN',
            toCurrency: to.currency || 'PEN',
            baseCurrency: fx.baseCurrency,
            ratesMap: fx.ratesMap,
          }),
          date: localDateTimeToISO(date, nowTimeLocal()),
          name: name.trim() || (mode === 'retiro' ? 'Retiro del negocio' : 'Aporte al negocio'),
          notes,
        });
      } else if (match) {
        await bizObligationsService.settle(match, account.id);
      } else {
        const p = party.trim()
          ? await partiesService.ensure(businessId, partyKind, party, parties)
          : null;
        const currency = account.currency || 'PEN';
        const signed = mode === 'gasto' ? -Math.abs(value) : Math.abs(value);
        const cat = categories.find((c) => c.label === category) ?? categories[0];
        await bizMovementsService.create({
          name: name.trim() || p!.name,
          type: mode,
          amount: signed,
          category: cat.label,
          categoryIcon: cat.icon,
          accountId: account.id,
          account: account.name,
          notes,
          date: localDateTimeToISO(date, nowTimeLocal()),
          time: nowTimeLocal(),
          partyId: p?.id ?? null,
          ...buildCurrencyFields({
            amount: signed,
            currency,
            baseCurrency: fx.baseCurrency,
            rateToBase: getRateFromMap(fx.ratesMap, currency, fx.baseCurrency),
            date,
          }),
        });
      }
      notifyDataChanged();
      toast.showSuccess(
        match ? (mode === 'ingreso' ? 'Cobro registrado.' : 'Pago registrado.') : 'Guardado.'
      );
      onSaved();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const saveLabel = match
    ? mode === 'ingreso'
      ? 'Marcar como cobrado'
      : 'Marcar como pagado'
    : mode === 'ingreso'
      ? 'Guardar ingreso'
      : mode === 'gasto'
        ? 'Guardar gasto'
        : 'Guardar';

  return (
    <Sheet title={TITLES[mode]} onClose={onClose}>
      <div className="mb-4 grid grid-cols-4 gap-1 rounded-2xl border-2 border-[#111] bg-white p-1">
        {(['ingreso', 'gasto', 'retiro', 'aporte'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-xl px-1 py-2 text-[12px] font-black ${
              mode === m ? 'paper-opaque bg-[#111] text-white' : 'text-[#111]'
            }`}
          >
            {m === 'ingreso'
              ? 'Ingreso'
              : m === 'gasto'
                ? 'Gasto'
                : m === 'retiro'
                  ? 'Retiro'
                  : 'Aporte'}
          </button>
        ))}
      </div>

      {bizAccounts && bizAccounts.length === 0 ? (
        <p className="rounded-xl bg-[#FFF3C4] px-3 py-3 text-sm font-bold">
          Agrega primero la cuenta de tu negocio en «Cuentas».
        </p>
      ) : (
        <div className="space-y-3">
          {!isTransfer && (
            <div className="rounded-2xl border-2 border-[#111] bg-white p-3">
              <span className={label}>Escríbelo como lo dirías</span>
              <div className="flex gap-2">
                <input
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && interpret()}
                  placeholder="Vega me pagó 5,000 · Pagué 850 a Makro"
                  className={field}
                />
                <button
                  type="button"
                  onClick={interpret}
                  aria-label="Completar con la frase"
                  className="paper-opaque grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-[#111] bg-[#FFD83D]"
                >
                  <Sparkles className="h-5 w-5" strokeWidth={2.5} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                disabled={reading !== null}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#111] bg-white py-2 text-xs font-black disabled:opacity-60"
              >
                {reading !== null ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Leyendo el comprobante…{' '}
                    {Math.round(reading * 100)}%
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" strokeWidth={2.5} /> Foto del comprobante
                  </>
                )}
              </button>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) readPhoto(f);
                }}
              />
              {understood && (
                <p className="mt-2 flex items-start gap-1.5 text-xs font-bold text-[#15803D]">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={3} /> {understood}
                </p>
              )}
              <p className="mt-1 text-[11px] font-semibold text-[#111]/55">
                Se lee en tu teléfono. Revisa los datos antes de guardar.
              </p>
            </div>
          )}

          {isTransfer && (
            <p className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#111]/80">
              {mode === 'retiro' ? (
                <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
              ) : (
                <ArrowDownLeft className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
              )}
              {mode === 'retiro'
                ? 'Pasa dinero del negocio a tu cuenta personal. No es un gasto del negocio ni un ingreso personal.'
                : 'Pasa dinero de tu cuenta personal al negocio. No es un ingreso del negocio.'}
            </p>
          )}

          <label className="block">
            <span className={label}>Monto</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`${field} text-2xl font-black`}
            />
          </label>

          {!isTransfer && (
            <PartyField kind={partyKind} parties={parties} value={party} onChange={setParty} />
          )}

          {match && (
            <div className="rounded-2xl border-2 border-[#111] bg-[#DDF7E9] p-3 text-sm font-bold">
              {knownParty?.name} tiene{' '}
              {mode === 'ingreso' ? 'un cobro pendiente' : 'un pago pendiente'} de{' '}
              {formatMoney(match.amount, account?.currency ?? 'PEN')} ({match.name}). Al guardar se
              marca como {mode === 'ingreso' ? 'cobrado' : 'pagado'}: no se cuenta dos veces.
            </div>
          )}
          {otherPending.length > 0 && (
            <p className="rounded-xl bg-[#FFF3C4] px-3 py-2 text-xs font-bold">
              {knownParty?.name} tiene{' '}
              {otherPending.length === 1 ? 'un pendiente' : `${otherPending.length} pendientes`} por
              otro monto. Si es ese, márcalo desde {mode === 'ingreso' ? 'Cobros' : 'Pagos'}.
            </p>
          )}

          {!match && (
            <>
              <label className="block">
                <span className={label}>
                  {isTransfer ? 'Descripción (opcional)' : 'Descripción'}
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    mode === 'ingreso'
                      ? 'Ej. Venta a Vega'
                      : mode === 'gasto'
                        ? 'Ej. Compra en Makro'
                        : ''
                  }
                  className={field}
                />
              </label>

              {!isTransfer && (
                <div>
                  <span className={label}>Categoría</span>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((c) => (
                      <button
                        key={c.label}
                        type="button"
                        aria-pressed={category === c.label}
                        onClick={() => setCategory(c.label)}
                        className={`flex items-center gap-1.5 rounded-xl border-2 border-[#111] px-2.5 py-1.5 text-xs font-bold ${
                          category === c.label ? 'paper-opaque bg-[#FFD83D]' : 'bg-white'
                        }`}
                      >
                        <Glyph name={c.icon} className="h-4 w-4" /> {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <label className="block">
            <span className={label}>Cuenta del negocio</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={field}
            >
              {(bizAccounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatMoney(a.balance, a.currency)})
                </option>
              ))}
            </select>
          </label>

          {isTransfer && (
            <label className="block">
              <span className={label}>Tu cuenta personal</span>
              <select
                value={personalId}
                onChange={(e) => setPersonalId(e.target.value)}
                className={field}
              >
                {personal.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatMoney(a.balance, a.currency)})
                  </option>
                ))}
              </select>
            </label>
          )}

          {!match && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className={label}>Fecha</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={field}
                />
              </label>
              <label className="block">
                <span className={label}>Nota (opcional)</span>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
              </label>
            </div>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving || !bizAccounts || bizAccounts.length === 0}
        className="paper-opaque mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] py-3.5 text-base font-black text-[#111] shadow-[0_4px_0_#111] disabled:opacity-60"
      >
        {saving && <Loader2 className="h-5 w-5 animate-spin" />}
        {saveLabel}
      </button>
    </Sheet>
  );
}
