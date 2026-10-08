'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  CalendarClock,
  ChevronLeft,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Trash2,
} from 'lucide-react';
import LoadError from '@/components/ui/LoadError';
import { useToast } from '@/components/ui/Toast';
import { card } from '@/components/dashboard/ui';
import ContextSwitch from '@/components/business/ContextSwitch';
import {
  Initials,
  KIND_LABEL,
  ObligationSheet,
  SettleSheet,
  Sheet,
  field,
  label,
} from '@/components/business/kit';
import { formatMoney } from '@/lib/format';
import { parseAmountInput } from '@/lib/amount';
import { todayLocal } from '@/lib/dates';
import { MONTHS_SHORT } from '@/lib/dashboard';
import { getErrorMessage } from '@/lib/dataError';
import { notifyDataChanged, useDataChanged } from '@/lib/dataSync';
import { whatsappLink } from '@/lib/business';
import {
  bizMovementsService,
  bizObligationsService,
  partiesService,
  type BizMovement,
  type BizObligation,
  type Party,
} from '@/lib/supabaseBusiness';
import { userSettingsService } from '@/lib/supabaseCurrency';

// One contact of a business (fase 4): how to reach them, what is pending, what was paid or
// collected, and the full history. Editing never touches past movements' amounts.

const shortDate = (s: string) => {
  const [y, mm, dd] = s.slice(0, 10).split('-').map(Number);
  return `${dd} ${MONTHS_SHORT[mm - 1]}. ${y}`;
};

export default function BusinessContactPage() {
  const { id, partyId } = useParams<{ id: string; partyId: string }>();
  const router = useRouter();
  const toast = useToast();
  const [party, setParty] = useState<Party | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [obligations, setObligations] = useState<BizObligation[]>([]);
  const [movements, setMovements] = useState<BizMovement[]>([]);
  const [currency, setCurrency] = useState('PEN');
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '', usual: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [adding, setAdding] = useState(false);
  const [settling, setSettling] = useState<BizObligation | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      partiesService.list(id),
      bizObligationsService.list(id),
      bizMovementsService.list(id, { partyId }),
      userSettingsService.get(),
    ])
      .then(([p, o, m, s]) => {
        const me = p.find((x) => x.id === partyId) ?? null;
        if (!me) throw new Error('Este contacto ya no existe.');
        setParties(p);
        setParty(me);
        setObligations(o.filter((x) => x.partyId === partyId));
        setMovements(m);
        setCurrency(s.baseCurrencyCode);
      })
      .catch(setError);
  }, [id, partyId]);
  useEffect(load, [load]);
  useDataChanged(load);

  const money = (n: number) => formatMoney(n, currency);
  const isClient = party?.kind === 'cliente';
  const pending = obligations.filter((o) => !o.done).sort((a, b) => a.due.localeCompare(b.due));
  const stats = useMemo(() => {
    const month = todayLocal().slice(0, 7);
    const mine = movements.filter((m) => m.type !== 'transferencia');
    return {
      pending: pending.reduce((a, o) => a + o.amount, 0),
      month: mine
        .filter((m) => String(m.date).slice(0, 7) === month)
        .reduce((a, m) => a + m.value, 0),
      total: mine.reduce((a, m) => a + m.value, 0),
      last: mine[0]?.date ? String(mine[0].date) : null,
    };
  }, [movements, pending]);

  const startEdit = () => {
    if (!party) return;
    setForm({
      name: party.name,
      phone: party.phone ?? '',
      email: party.email ?? '',
      notes: party.notes ?? '',
      usual: party.usualAmount != null ? String(party.usualAmount) : '',
    });
    setFormError('');
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!party) return;
    setFormError('');
    if (!form.name.trim()) return setFormError('Escribe el nombre.');
    const usual = form.usual.trim() ? parseAmountInput(form.usual) : null;
    if (usual !== null && !(usual >= 0)) return setFormError('Revisa el sueldo.');
    setSaving(true);
    try {
      await partiesService.update(party.id, {
        name: form.name,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
        ...(party.kind === 'empleado' ? { usualAmount: usual } : {}),
      });
      notifyDataChanged();
      setEditing(false);
      toast.showSuccess('Contacto actualizado.');
      load();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!party) return;
    try {
      await partiesService.update(party.id, { active: !party.active });
      notifyDataChanged();
      load();
    } catch (e) {
      toast.showError(e);
    }
  };

  const remove = async () => {
    if (!party) return;
    const msg =
      pending.length > 0
        ? `¿Eliminar a ${party.name}? También se eliminarán sus ${pending.length} pendientes. Los movimientos ya registrados se conservan.`
        : `¿Eliminar a ${party.name}? Los movimientos ya registrados se conservan.`;
    if (!window.confirm(msg)) return;
    try {
      for (const o of pending) await bizObligationsService.remove(o);
      await partiesService.remove(party.id);
      notifyDataChanged();
      router.replace(`/finanzas/negocio/${id}/contactos`);
    } catch (e) {
      toast.showError(e);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <LoadError what="el contacto" error={error} onRetry={load} />
      </div>
    );
  }
  if (!party) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const wa = whatsappLink(party.phone);
  const action = isClient ? 'Registrar cobro' : 'Registrar pago';
  const colorPending = isClient ? 'text-[#15803D]' : 'text-[#B42318]';

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-5 text-[#111] lg:px-8 lg:py-6">
      <ContextSwitch className="mb-4 lg:hidden" />
      <Link
        href={`/finanzas/negocio/${id}/contactos`}
        className="mb-3 inline-flex items-center gap-1 text-sm font-black"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.8} /> Contactos
      </Link>

      <section className={`${card} mb-4 p-5`}>
        <div className="flex items-start gap-3">
          <Initials
            name={party.name}
            color={isClient ? '#45D98B' : party.kind === 'empleado' ? '#B99CFF' : '#FF806E'}
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[24px] font-black leading-tight">{party.name}</h1>
            <p className="text-xs font-bold text-[#111]/60">
              {KIND_LABEL[party.kind]}
              {!party.active ? ' · inactivo' : ''}
              {party.kind === 'empleado' && party.usualAmount != null
                ? ` · ${money(party.usualAmount)} al mes`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={startEdit}
            aria-label="Editar contacto"
            className="grid h-9 w-9 place-items-center rounded-xl border-2 border-[#111] bg-white"
          >
            <Pencil className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        {(party.phone || party.email) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {party.phone && (
              <a
                href={`tel:${party.phone.replace(/[^\d+]/g, '')}`}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#111] bg-white px-3 py-1.5 text-xs font-black"
              >
                <Phone className="h-4 w-4" strokeWidth={2.5} /> {party.phone}
              </a>
            )}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#111] bg-[#DDF7E9] px-3 py-1.5 text-xs font-black"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={2.5} /> WhatsApp
              </a>
            )}
            {party.email && (
              <a
                href={`mailto:${party.email}`}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#111] bg-white px-3 py-1.5 text-xs font-black"
              >
                <Mail className="h-4 w-4" strokeWidth={2.5} /> {party.email}
              </a>
            )}
          </div>
        )}
        {party.notes && (
          <p className="mt-3 whitespace-pre-line text-sm font-semibold text-[#111]/80">
            {party.notes}
          </p>
        )}
      </section>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [isClient ? 'Te debe' : 'Le debes', money(stats.pending), colorPending],
          [isClient ? 'Cobrado este mes' : 'Pagado este mes', money(stats.month), ''],
          [isClient ? 'Cobrado en total' : 'Pagado en total', money(stats.total), ''],
          ['Último movimiento', stats.last ? shortDate(stats.last) : '—', ''],
        ].map(([title, value, color]) => (
          <div key={title} className={`${card} p-3`}>
            <p className="text-[11px] font-black uppercase tracking-wide text-[#111]/60">{title}</p>
            <p className={`mt-1 text-base font-black tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-black">Pendientes</h2>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="paper-opaque inline-flex items-center gap-1.5 rounded-xl border-2 border-[#111] bg-[#111] px-3 py-1.5 text-xs font-black text-white"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> {action}
        </button>
      </div>
      {pending.length === 0 ? (
        <p className={`${card} mb-5 p-4 text-sm font-bold text-[#111]/70`}>Nada pendiente.</p>
      ) : (
        <ul className="mb-5 space-y-2">
          {pending.map((o) => {
            const overdue = o.due < todayLocal();
            return (
              <li key={o.id} className={`${card} flex items-center gap-3 p-4`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black">{o.name}</p>
                  <p
                    className={`flex items-center gap-1 text-xs font-semibold ${overdue ? 'text-[#B42318]' : 'text-[#111]/60'}`}
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    {overdue ? 'Vencido ' : 'Vence '}
                    {shortDate(o.due)}
                    {o.isRecurring ? ' · mensual' : ''}
                  </p>
                </div>
                <p className="font-black tabular-nums">{money(o.amount)}</p>
                <button
                  type="button"
                  onClick={() => setSettling(o)}
                  className="paper-opaque rounded-lg border-2 border-[#111] bg-[#FFD83D] px-2.5 py-1 text-xs font-black"
                >
                  {o.type === 'cobro' ? 'Cobrar' : 'Pagar'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mb-2 text-base font-black">Historial</h2>
      {movements.length === 0 ? (
        <p className={`${card} mb-5 p-4 text-sm font-bold text-[#111]/70`}>
          Todavía no hay movimientos con {party.name}.
        </p>
      ) : (
        <ul className={`${card} mb-5 divide-y divide-[#111]/10 px-4`}>
          {movements.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{m.name}</span>
                <span className="text-xs font-semibold text-[#111]/60">
                  {shortDate(String(m.date))} · {m.category}
                </span>
              </span>
              <span
                className={`shrink-0 whitespace-nowrap text-sm font-black tabular-nums ${m.type === 'ingreso' ? 'text-[#15803D]' : ''}`}
              >
                {m.type === 'ingreso' ? '+' : '-'} {money(m.value)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleActive}
          className="rounded-xl border-2 border-[#111] bg-white px-3 py-2 text-sm font-black"
        >
          {party.active ? 'Marcar como inactivo' : 'Reactivar'}
        </button>
        <button
          type="button"
          onClick={remove}
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#B42318] bg-white px-3 py-2 text-sm font-black text-[#B42318]"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.5} /> Eliminar contacto
        </button>
      </div>

      {editing && (
        <Sheet title="Editar contacto" onClose={() => setEditing(false)}>
          <div className="space-y-3">
            <label className="block">
              <span className={label}>Nombre</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={field}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className={label}>Teléfono</span>
                <input
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={field}
                />
              </label>
              <label className="block">
                <span className={label}>Correo</span>
                <input
                  inputMode="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={field}
                />
              </label>
            </div>
            {party.kind === 'empleado' && (
              <label className="block">
                <span className={label}>Sueldo mensual</span>
                <input
                  inputMode="decimal"
                  value={form.usual}
                  onChange={(e) => setForm({ ...form, usual: e.target.value })}
                  className={field}
                />
                <span className="mt-1 block text-[11px] font-semibold text-[#111]/60">
                  Cambia el total del equipo. Los pagos ya creados mantienen su monto.
                </span>
              </label>
            )}
            <label className="block">
              <span className={label}>Notas</span>
              <textarea
                value={form.notes}
                maxLength={500}
                rows={3}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={field}
              />
            </label>
          </div>
          {formError && (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]"
            >
              {formError}
            </p>
          )}
          <button
            type="button"
            onClick={saveEdit}
            disabled={saving}
            className="paper-opaque mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] py-3.5 text-base font-black shadow-[0_4px_0_#111] disabled:opacity-60"
          >
            {saving && <Loader2 className="h-5 w-5 animate-spin" />} Guardar
          </button>
        </Sheet>
      )}
      {adding && (
        <ObligationSheet
          businessId={id}
          type={isClient ? 'cobro' : 'pago'}
          parties={parties}
          presetParty={party.name}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}
      {settling && (
        <SettleSheet
          businessId={id}
          obligation={settling}
          onClose={() => setSettling(null)}
          onDone={() => {
            setSettling(null);
            toast.showSuccess(settling.type === 'cobro' ? 'Cobro registrado.' : 'Pago registrado.');
            load();
          }}
        />
      )}
    </div>
  );
}
