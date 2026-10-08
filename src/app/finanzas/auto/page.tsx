'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Camera,
  ClipboardPaste,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import LoadError from '@/components/ui/LoadError';
import AutoGmailCard from '@/components/finance/AutoGmailCard';
import PlusGate from '@/components/billing/PlusGate';
import BrandLogo from '@/components/finance/BrandLogo';
import Glyph from '@/components/ui/Glyph';
import VoiceButton from '@/components/finance/VoiceButton';
import { useToast } from '@/components/ui/Toast';
import { parseBankMessage } from '@/lib/auto';
import { readImageText } from '@/lib/ocr';
import {
  autoService,
  rulesService,
  suggestDefaults,
  type AutoRules,
  type AutoSuggestion,
} from '@/lib/supabaseAuto';
import { accountsService } from '@/lib/supabaseFinance';
import { formatCurrency } from '@/lib/currency';
import { getErrorMessage } from '@/lib/dataError';
import { notifyDataChanged, useAutoSuggestion, useDataChanged } from '@/lib/dataSync';
import { CATEGORY_PRESETS, type Account } from '@/lib/financeStore';
import { looksLikeHouseholdExpense } from '@/lib/household';
import { householdService, shareOwnMovement } from '@/lib/supabaseHousehold';
import { monthNames } from '@/lib/format';

const BANK_LABEL: Record<string, string> = {
  bcp: 'BCP',
  bbva: 'BBVA',
  interbank: 'Interbank',
  yape: 'Yape',
  plin: 'Plin',
  scotiabank: 'Scotiabank',
  otro: 'Manual',
};

const MONTHS = monthNames('short');
const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
};

const inputClass =
  'w-full px-4 h-14 bg-white rounded-2xl border-[3px] border-[#111] text-[16px] font-bold text-[#111] placeholder:font-semibold placeholder:text-gray-400 outline-none focus:shadow-[0_0_0_3px_#FFD83D] transition-shadow';
const labelClass = 'block text-xs font-black text-black uppercase tracking-wide mb-1.5';

function TypeBadge({ type }: { type: AutoSuggestion['type'] }) {
  const cfg = {
    gasto: { label: 'Gasto', icon: ArrowUpRight, cls: 'bg-[#FFE4DE] text-[#B42318]' },
    ingreso: { label: 'Ingreso', icon: ArrowDownLeft, cls: 'bg-[#DDF7E9] text-[#067647]' },
    transferencia: {
      label: 'Transferencia',
      icon: ArrowLeftRight,
      cls: 'bg-[#E0EDFF] text-[#1D4ED8]',
    },
  }[type];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${cfg.cls}`}
    >
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

function signedAmount(s: AutoSuggestion) {
  const sign = s.type === 'gasto' ? '-' : s.type === 'ingreso' ? '+' : '';
  return `${sign}${formatCurrency(s.amount, s.currency)}`;
}

export default function MoneoAutoPage() {
  return (
    <PlusGate
      feature="MONEO AUTO"
      description="Registra tus movimientos con capturas, tu voz, el texto de tu banco o tu Gmail, sin escribirlos uno por uno. Tus sugerencias guardadas siguen aquí."
    >
      <MoneoAuto />
    </PlusGate>
  );
}

function MoneoAuto() {
  const toast = useToast();
  const [items, setItems] = useState<AutoSuggestion[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rules, setRules] = useState<AutoRules>({ cardAccount: {}, merchantCategory: {} });
  const [loadError, setLoadError] = useState<unknown>(null);
  const [text, setText] = useState('');
  const [pasteMsg, setPasteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  // OCR progress (0–1) while reading a screenshot or receipt photo; null when idle.
  const [reading, setReading] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [registering, setRegistering] = useState<AutoSuggestion | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    Promise.all([autoService.list(), accountsService.getAll(), rulesService.get()])
      .then(([list, accs, r]) => {
        setItems(list);
        setAccounts(accs);
        setRules(r);
      })
      .catch(setLoadError);
  }, []);

  useDataChanged(load);

  useEffect(() => {
    load();
  }, [load]);

  // Forwarded emails arrive in the background: AutoLiveListener (Realtime) signals each new
  // suggestion and app refocus; a slow poll covers a dropped socket.
  const refreshItems = useCallback(() => {
    autoService
      .list()
      .then(setItems)
      .catch(() => {});
  }, []);

  useAutoSuggestion(refreshItems);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refreshItems();
    }, 60000);
    return () => clearInterval(id);
  }, [refreshItems]);

  const pending = useMemo(() => (items ?? []).filter((s) => s.status === 'pendiente'), [items]);
  const history = useMemo(
    () => (items ?? []).filter((s) => s.status !== 'pendiente').slice(0, 20),
    [items]
  );

  // The pasted text is interpreted here, in the browser; only the result is saved.
  const handlePaste = async (input: string = text, fromImage = false) => {
    const parsed = parseBankMessage({ source: 'text', text: input, receivedAt: new Date() });
    if (!parsed) {
      setPasteMsg({
        ok: false,
        text: fromImage
          ? 'Leímos la imagen pero no encontramos el movimiento. Revisa el texto de arriba: deja el monto y el concepto, y toca Interpretar.'
          : 'No encontramos un monto. Prueba con «gasté 25 en taxi» o pega el aviso de tu banco (BCP, BBVA, Interbank, Yape o Plin).',
      });
      return;
    }
    setAdding(true);
    try {
      const result = await autoService.add(parsed, 'text');
      if (result.status === 'duplicate') {
        setPasteMsg({
          ok: false,
          text: 'Este movimiento ya está en tu bandeja (no lo duplicamos).',
        });
      } else {
        setItems((prev) => [result.suggestion, ...(prev ?? [])]);
        setPasteMsg({
          ok: true,
          text: `Detectamos: ${parsed.merchant} · ${signedAmount(result.suggestion)}. Revísalo abajo.`,
        });
        setText('');
      }
    } catch (err) {
      setPasteMsg({ ok: false, text: getErrorMessage(err) });
    } finally {
      setAdding(false);
    }
  };

  // Screenshot or photo of a receipt: read in the browser (never uploaded), then
  // interpreted like pasted text.
  const handleImage = async (file: File | undefined) => {
    if (!file) return;
    setPasteMsg(null);
    setReading(0);
    try {
      const ocrText = await readImageText(
        file,
        setReading,
        (t) => parseBankMessage({ source: 'text', text: t, receivedAt: new Date() }) !== null
      );
      setText(ocrText);
      if (!ocrText.trim()) {
        setPasteMsg({
          ok: false,
          text: 'No pudimos leer texto en la imagen. Prueba con una foto más nítida.',
        });
      } else {
        await handlePaste(ocrText, true);
      }
    } catch (err) {
      console.error(err);
      setPasteMsg({ ok: false, text: 'No pudimos leer la imagen. Intenta de nuevo.' });
    } finally {
      setReading(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const setStatus = async (s: AutoSuggestion, status: 'pendiente' | 'ignorada') => {
    try {
      await autoService.setStatus(s.id, status);
      setItems((prev) => (prev ?? []).map((x) => (x.id === s.id ? { ...x, status } : x)));
    } catch (err) {
      toast.showError(err);
    }
  };

  if (loadError) {
    return (
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-black text-black mb-5 leading-tight">MONEO AUTO</h1>
        <LoadError what="tu bandeja" error={loadError} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-3xl font-black text-black leading-tight">
          MONEO AUTO
          <span className="rounded-full border-2 border-black bg-[#FFD43B] px-2 py-0.5 text-[10px] font-black uppercase">
            Beta
          </span>
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Tus avisos del banco se convierten en movimientos. Tú decides: registrar, editar o
          ignorar.
        </p>
      </div>

      {/* Paste a notice */}
      <section className="mb-6 rounded-3xl border-[3px] border-black bg-white p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
        <div className="mb-2 flex items-center gap-2">
          <ClipboardPaste className="h-5 w-5" />
          <h2 className="font-black text-black">Registra a tu manera</h2>
        </div>
        <p className="mb-3 text-xs text-gray-600">
          Escribe o dicta como hablas («gasté 25 en taxi», «almuerzo 18 bcp», «me pagaron 1500»),
          pega el aviso de tu banco o sube una captura o foto de tu boleta.
        </p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPasteMsg(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && text.trim() && !adding) {
              e.preventDefault();
              handlePaste();
            }
          }}
          rows={3}
          placeholder="Ej.: gasté 25 en taxi"
          className={`${inputClass} resize-y`}
        />
        {pasteMsg && (
          <p
            role="status"
            className={`mt-2 text-sm font-semibold ${pasteMsg.ok ? 'text-green-700' : 'text-red-600'}`}
          >
            {pasteMsg.text}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> No guardamos el texto ni las imágenes
            (se leen en tu teléfono): solo monto, concepto, fecha y últimos 4 dígitos.
          </p>
          <div className="flex w-full items-center gap-2 pr-1 sm:w-auto">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImage(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={adding || reading !== null}
              aria-label="Leer captura o foto de boleta"
              title="Captura o foto de boleta"
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border-[3px] border-black bg-white px-3 text-sm font-black text-black shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 disabled:opacity-60"
            >
              <Camera className="h-5 w-5" />
              {reading !== null ? `${Math.round(reading * 100)}%` : 'Captura'}
            </button>
            <VoiceButton
              disabled={adding}
              onPartial={(t) => {
                setText(t);
                setPasteMsg(null);
              }}
              onFinal={(t) => {
                setText(t);
                handlePaste(t);
              }}
              onError={(m) => setPasteMsg({ ok: false, text: m })}
            />
            <button
              onClick={() => handlePaste()}
              disabled={adding || !text.trim()}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border-[3px] border-black bg-[#FFD43B] px-4 text-sm font-black text-black shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 disabled:opacity-50 sm:flex-none"
            >
              <Sparkles className="h-4 w-4" /> {adding ? 'Leyendo…' : 'Interpretar'}
            </button>
          </div>
        </div>
      </section>

      {/* Gmail conectado por OAuth. El reenvío de correos (AutoEmailCard) sigue oculto:
          casi nadie lo configuraba. */}
      <AutoGmailCard />

      {/* Inbox */}
      <h2 className="mb-3 text-lg font-black text-black">
        Por revisar{' '}
        {pending.length > 0 && <span className="text-gray-500">({pending.length})</span>}
      </h2>
      {items === null ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FFD43B] border-t-transparent" />
        </div>
      ) : pending.length === 0 ? (
        <div className="mb-6 rounded-3xl border-[3px] border-dashed border-gray-300 px-4 py-10 text-center">
          <p className="font-bold text-gray-600">No tienes movimientos por revisar.</p>
          <p className="mt-1 text-xs text-gray-500">Escribe «gasté 25 en taxi» para probar.</p>
        </div>
      ) : (
        <ul className="mb-6 space-y-3">
          {pending.map((s) => (
            <li
              key={s.id}
              className="rounded-3xl border-[3px] border-black bg-white p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)]"
            >
              <div className="flex items-start gap-3">
                <BrandLogo
                  kind="account"
                  name={BANK_LABEL[s.bank]}
                  institution={BANK_LABEL[s.bank]}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <TypeBadge type={s.type} />
                    {s.recurring && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                        Recurrente
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate font-black text-black">
                    {s.merchant || 'Movimiento'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {BANK_LABEL[s.bank]}
                    {s.cardLast4 ? ` ····${s.cardLast4}` : ''} · {fmtDate(s.date)}
                    {s.time ? ` · ${s.time}` : ''}
                    {s.suggestedCategory ? ` · ${s.suggestedCategory}` : ''}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-lg font-black tabular-nums ${
                    s.type === 'gasto'
                      ? 'text-[#B42318]'
                      : s.type === 'ingreso'
                        ? 'text-[#067647]'
                        : 'text-black'
                  }`}
                >
                  {signedAmount(s)}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  onClick={() => setRegistering(s)}
                  className="rounded-xl border-[2.5px] border-black bg-[#45D98B] py-2 text-xs font-black text-black"
                >
                  Registrar
                </button>
                <button
                  onClick={() => setRegistering(s)}
                  className="rounded-xl border-[2.5px] border-black bg-white py-2 text-xs font-black text-black"
                >
                  Editar
                </button>
                <button
                  onClick={() => setStatus(s, 'ignorada')}
                  className="rounded-xl border-[2.5px] border-black bg-white py-2 text-xs font-black text-black"
                >
                  Ignorar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {history.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-black text-black">Historial</h2>
          <ul className="overflow-hidden rounded-3xl border-[3px] border-black bg-white">
            {history.map((s, i) => (
              <li
                key={s.id}
                className={`flex items-center gap-3 px-4 py-3 ${i < history.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-black">
                    {s.merchant || 'Movimiento'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {fmtDate(s.date)} · {s.status === 'registrada' ? 'Registrado' : 'Ignorado'}
                  </p>
                </div>
                <p className="text-sm font-black tabular-nums text-gray-700">{signedAmount(s)}</p>
                {s.status === 'ignorada' && (
                  <button
                    onClick={() => setStatus(s, 'pendiente')}
                    className="rounded-lg p-1.5 hover:bg-gray-100"
                    aria-label="Volver a revisar"
                    title="Volver a revisar"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {registering && (
        <RegisterModal
          suggestion={registering}
          accounts={accounts}
          rules={rules}
          onClose={() => setRegistering(null)}
          onDone={() => {
            setRegistering(null);
            notifyDataChanged();
          }}
        />
      )}
    </div>
  );
}

function RegisterModal({
  suggestion: s,
  accounts,
  rules,
  onClose,
  onDone,
}: {
  suggestion: AutoSuggestion;
  accounts: Account[];
  rules: AutoRules;
  onClose: () => void;
  onDone: () => void;
}) {
  const defaults = suggestDefaults(s, rules, accounts);
  const [name, setName] = useState(s.merchant);
  // Card rule first; otherwise the first registered account (the user can change it).
  const [accountId, setAccountId] = useState(defaults.accountId || accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(
    () => accounts.find((a) => a.id !== (defaults.accountId || accounts[0]?.id))?.id ?? ''
  );
  const [category, setCategory] = useState(defaults.categoryLabel);
  const [date, setDate] = useState(s.date);
  const [time, setTime] = useState(s.time ?? '');
  const [accountAmount, setAccountAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  // MONEO HOGAR: an expense in a household category is suggested as shared; the user
  // decides (null = follow the suggestion).
  const [householdName, setHouseholdName] = useState<string | null>(null);
  const [toHome, setToHome] = useState<boolean | null>(null);
  useEffect(() => {
    if (s.type !== 'gasto') return;
    householdService
      .getMine()
      .then((h) => setHouseholdName(h?.household.name ?? null))
      .catch(() => setHouseholdName(null));
  }, [s.type]);
  const suggestedHome = looksLikeHouseholdExpense(category);
  const shareWithHome = !!householdName && s.type === 'gasto' && (toHome ?? suggestedHome);

  const account = accounts.find((a) => a.id === accountId);
  const foreign = !!account && (account.currency || 'PEN') !== s.currency;
  const isTransfer = s.type === 'transferencia';
  const categories = CATEGORY_PRESETS.filter((c) =>
    s.type === 'ingreso' ? true : c.id !== 'ingreso'
  );

  const save = async () => {
    if (!accountId) return setError(isTransfer ? 'Elige la cuenta de origen.' : 'Elige la cuenta.');
    if (isTransfer && (!toAccountId || toAccountId === accountId))
      return setError('Elige la cuenta de destino.');
    const amt = parseFloat(accountAmount);
    if (foreign && !(amt > 0)) return setError(`Indica el monto en ${account?.currency}.`);
    setSaving(true);
    setError('');
    try {
      const { transactionId } = await autoService.register(
        s,
        {
          accountId,
          toAccountId: isTransfer ? toAccountId : undefined,
          accountAmount: foreign ? amt : undefined,
          categoryLabel: isTransfer ? '' : category,
          name: name.trim(),
          date,
          time: time || null,
        },
        accounts
      );
      if (shareWithHome && transactionId) {
        // The movement is already registered: a failure here only skips the household.
        await shareOwnMovement({
          transactionId,
          name: name.trim() || s.merchant,
          category,
          amount: s.amount,
          currency: s.currency,
          date,
          source: 'auto',
        })
          .then((ok) => ok && toast.showSuccess(`También se agregó a ${householdName}.`))
          .catch((err) =>
            toast.showError(
              `Se registró, pero no se pudo agregar al hogar: ${getErrorMessage(err)}`
            )
          );
      }
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  const accountOptions = (exclude?: string) =>
    accounts
      .filter((a) => a.id !== exclude)
      .map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} ({a.currency})
        </option>
      ));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => !saving && onClose()}
      />
      <div className="relative max-h-[92dvh] w-full space-y-3 overflow-y-auto rounded-t-3xl border-[3px] border-black bg-white p-5 shadow-[6px_6px_0px_rgba(0,0,0,1)] sm:max-w-md sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-black text-black">
              Registrar {s.type === 'ingreso' ? 'ingreso' : isTransfer ? 'transferencia' : 'gasto'}
            </h2>
            <p className="text-2xl font-black tabular-nums text-black">{signedAmount(s)}</p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
            className="rounded-full p-1 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className={labelClass}>Descripción</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>

        {accounts.length === 0 ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            Primero agrega una cuenta en{' '}
            <Link href="/finanzas/cuentas" className="font-bold underline">
              Cuentas
            </Link>
            .
          </p>
        ) : (
          <>
            <div>
              <label className={labelClass}>{isTransfer ? 'Desde' : 'Cuenta'}</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className={inputClass}
              >
                <option value="">Elige la cuenta</option>
                {accountOptions()}
              </select>
              {s.cardLast4 && defaults.accountId && accountId === defaults.accountId && (
                <p className="mt-1 text-[11px] text-gray-500">
                  Sugerida porque usas la tarjeta ····{s.cardLast4} en esta cuenta.
                </p>
              )}
            </div>
            {isTransfer && (
              <div>
                <label className={labelClass}>Hacia</label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Elige la cuenta de destino</option>
                  {accountOptions(accountId)}
                </select>
                {s.destinationBank && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    El banco indica destino {s.destinationBank}
                    {s.destinationLast4 ? ` ····${s.destinationLast4}` : ''}.
                  </p>
                )}
              </div>
            )}
            {foreign && (
              <div>
                <label className={labelClass}>Monto en {account?.currency}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={accountAmount}
                  onChange={(e) => setAccountAmount(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}
          </>
        )}

        {!isTransfer && (
          <div>
            <label className={labelClass}>Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.label}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Hora</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {householdName && s.type === 'gasto' && (
          <div
            className={`rounded-xl border-2 p-3 ${suggestedHome ? 'border-black bg-[#FFF4CC]' : 'border-gray-200 bg-white'}`}
          >
            {suggestedHome && (
              <p className="mb-1 flex items-center gap-1.5 text-xs font-black text-black">
                <Glyph name="home" className="h-3.5 w-3.5 shrink-0" />
                Detectamos un posible gasto del hogar.
              </p>
            )}
            <label className="flex items-start gap-2 text-sm font-bold text-black">
              <input
                type="checkbox"
                checked={shareWithHome}
                onChange={(e) => setToHome(e.target.checked)}
                className="mt-0.5 h-5 w-5 accent-black"
              />
              <span>
                Agregarlo a {householdName}
                <span className="block text-[11px] font-semibold text-gray-500">
                  Lo pagaste tú; se reparte según el hogar. Tu cuenta sigue siendo privada.
                </span>
              </span>
            </label>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border-[3px] border-black bg-white py-3 text-sm font-black text-black disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || accounts.length === 0}
            className="flex-1 rounded-xl border-[3px] border-black bg-[#FFD43B] py-3 text-sm font-black text-black shadow-[3px_3px_0px_rgba(0,0,0,1)] disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
