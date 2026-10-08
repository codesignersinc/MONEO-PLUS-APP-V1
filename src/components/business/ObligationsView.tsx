'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ChevronLeft, Plus, Trash2 } from 'lucide-react';
import LoadError from '@/components/ui/LoadError';
import { useToast } from '@/components/ui/Toast';
import { card } from '@/components/dashboard/ui';
import ContextSwitch from './ContextSwitch';
import { useNegocio } from './useNegocio';
import { Initials, ObligationSheet, SettleSheet } from './kit';
import { formatMoney } from '@/lib/format';
import { todayLocal } from '@/lib/dates';
import { MONTHS_SHORT } from '@/lib/dashboard';
import { useDataChanged } from '@/lib/dataSync';
import {
  bizMovementsService,
  bizObligationsService,
  partiesService,
  type BizMovement,
  type BizObligation,
  type Party,
} from '@/lib/supabaseBusiness';
import { userSettingsService } from '@/lib/supabaseCurrency';

// Cobros y clientes / Pagos y proveedores of a business (fase 3): what is pending, settled
// with a business account, and each contact's totals. No CRM: name, contact and amounts.

const COLORS = ['#B99CFF', '#75B8FF', '#45D98B', '#FFD83D', '#FF806E'];

const shortDate = (d: string) => {
  const [, mm, dd] = d.split('-').map(Number);
  return `${dd} ${MONTHS_SHORT[mm - 1]}.`;
};

export default function ObligationsView({
  businessId,
  type,
}: {
  businessId: string;
  type: 'cobro' | 'pago';
}) {
  const toast = useToast();
  const { businesses } = useNegocio();
  const business = businesses.find((b) => b.id === businessId);
  const kind = type === 'cobro' ? 'cliente' : 'proveedor';
  const [obligations, setObligations] = useState<BizObligation[] | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [movements, setMovements] = useState<BizMovement[]>([]);
  const [currency, setCurrency] = useState('PEN');
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState<'pendientes' | 'contactos' | 'hechos'>('pendientes');
  const [adding, setAdding] = useState<string | null>(null); // preset contact name
  const [settling, setSettling] = useState<BizObligation | null>(null);

  const load = useCallback(() => {
    setError(null);
    const monthStart = `${todayLocal().slice(0, 7)}-01`;
    Promise.all([
      bizObligationsService.list(businessId),
      partiesService.list(businessId),
      bizMovementsService.list(businessId, monthStart),
      userSettingsService.get(),
    ])
      .then(([o, p, m, s]) => {
        setObligations(o.filter((x) => x.type === type));
        setParties(p);
        setMovements(m);
        setCurrency(s.baseCurrencyCode);
      })
      .catch(setError);
  }, [businessId, type]);
  useEffect(load, [load]);
  useDataChanged(load);

  const money = (n: number) => formatMoney(n, currency);
  const today = todayLocal();
  const pending = (obligations ?? [])
    .filter((o) => !o.done)
    .sort((a, b) => a.due.localeCompare(b.due));
  const done = (obligations ?? []).filter((o) => o.done).sort((a, b) => b.due.localeCompare(a.due));
  const totalPending = pending.reduce((a, o) => a + o.amount, 0);
  const partyName = (id: string | null) => parties.find((p) => p.id === id)?.name ?? null;

  // Per contact: pending, settled this month, last movement.
  const contacts = useMemo(() => {
    const movType = type === 'cobro' ? 'ingreso' : 'gasto';
    return parties
      .filter((p) => p.kind === kind)
      .map((p) => {
        const mine = movements.filter((m) => m.partyId === p.id && m.type === movType);
        return {
          party: p,
          pending: pending.filter((o) => o.partyId === p.id).reduce((a, o) => a + o.amount, 0),
          month: mine.reduce((a, m) => a + m.value, 0),
          last: mine[0]?.date ? String(mine[0].date).slice(0, 10) : null,
        };
      })
      .sort((a, b) => b.pending - a.pending || b.month - a.month);
  }, [parties, movements, pending, kind, type]);

  const remove = async (o: BizObligation) => {
    if (!window.confirm(`¿Eliminar «${o.name}»?`)) return;
    try {
      await bizObligationsService.remove(o);
      load();
    } catch (e) {
      toast.showError(e);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <LoadError
          what={type === 'cobro' ? 'los cobros' : 'los pagos'}
          error={error}
          onRetry={load}
        />
      </div>
    );
  }

  const T =
    type === 'cobro'
      ? {
          title: 'Cobros y clientes',
          total: 'Te deben',
          add: 'Registrar cobro',
          settle: 'Cobrar',
          done: 'Cobrados',
          contacts: 'Clientes',
          month: 'Cobrado este mes',
          none: 'No tienes cobros pendientes.',
        }
      : {
          title: 'Pagos y proveedores',
          total: 'Debes',
          add: 'Registrar pago',
          settle: 'Pagar',
          done: 'Pagados',
          contacts: 'Proveedores',
          month: 'Pagado este mes',
          none: 'No tienes pagos pendientes.',
        };

  const tabBtn = (k: typeof tab, text: string, count?: number) => (
    <button
      type="button"
      aria-pressed={tab === k}
      onClick={() => setTab(k)}
      className={`rounded-xl border-2 border-[#111] px-3 py-1.5 text-xs font-black ${
        tab === k ? 'paper-opaque bg-[#111] text-white' : 'bg-white'
      }`}
    >
      {text}
      {count !== undefined ? ` · ${count}` : ''}
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-5 text-[#111] lg:px-8 lg:py-6">
      <ContextSwitch className="mb-4 lg:hidden" />
      <Link
        href={`/finanzas/negocio/${businessId}`}
        className="mb-3 inline-flex items-center gap-1 text-sm font-black"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.8} /> {business?.name ?? 'Negocio'}
      </Link>
      <h1 className="mb-4 text-[28px] font-black leading-tight">{T.title}</h1>

      <div
        className={`${card} mb-4 flex items-center justify-between gap-3 p-5 ${type === 'cobro' ? 'bg-[#DDF7E9]' : 'bg-[#FFE1DB]'}`}
      >
        <div>
          <p className="text-sm font-black">{T.total}</p>
          <p className="text-[24px] font-black leading-none tabular-nums sm:text-[30px]">
            {money(totalPending)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding('')}
          className="paper-opaque inline-flex items-center gap-1.5 rounded-xl border-2 border-[#111] bg-[#111] px-3 py-2.5 text-sm font-black text-white"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> {T.add}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabBtn('pendientes', 'Pendientes', pending.length)}
        {tabBtn('contactos', T.contacts, contacts.length)}
        {tabBtn('hechos', T.done)}
      </div>

      {!obligations ? (
        <div className="h-32 animate-pulse rounded-[22px] border-2 border-[#111]/20 bg-white" />
      ) : tab === 'contactos' ? (
        contacts.length === 0 ? (
          <p className={`${card} p-5 text-sm font-bold`}>
            Aún no tienes {T.contacts.toLowerCase()}. Se agregan solos al registrar un {type} con su
            nombre.
          </p>
        ) : (
          <ul className="space-y-2">
            {contacts.map((c, i) => (
              <li key={c.party.id} className={`${card} flex items-center gap-3 p-4`}>
                <Initials name={c.party.name} color={COLORS[i % COLORS.length]} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/finanzas/negocio/${businessId}/contactos/${c.party.id}`}
                    className="block truncate font-black hover:underline"
                  >
                    {c.party.name}
                  </Link>
                  <p className="text-xs font-semibold text-[#111]/60">
                    {T.month}: {money(c.month)}
                    {c.last ? ` · último ${shortDate(c.last)}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-black tabular-nums ${c.pending > 0 ? (type === 'cobro' ? 'text-[#15803D]' : 'text-[#B42318]') : ''}`}
                  >
                    {money(c.pending)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAdding(c.party.name)}
                    className="text-[11px] font-black underline"
                  >
                    {T.add}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        (() => {
          const list = tab === 'pendientes' ? pending : done;
          if (list.length === 0) {
            return (
              <p className={`${card} p-5 text-sm font-bold`}>
                {tab === 'pendientes' ? T.none : 'Todavía no hay registros.'}
              </p>
            );
          }
          return (
            <ul className="space-y-2">
              {list.map((o, i) => {
                const who = partyName(o.partyId);
                const overdue = !o.done && o.due < today;
                return (
                  <li key={o.id} className={`${card} flex items-center gap-3 p-4`}>
                    <Initials name={who ?? o.name} color={COLORS[i % COLORS.length]} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black">{who ?? o.name}</p>
                      <p
                        className={`flex items-center gap-1 text-xs font-semibold ${overdue ? 'text-[#B42318]' : 'text-[#111]/60'}`}
                      >
                        {who && <span className="truncate">{o.name} · </span>}
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                        {o.done
                          ? shortDate(o.due)
                          : overdue
                            ? `Vencido ${shortDate(o.due)}`
                            : `Vence ${shortDate(o.due)}`}
                        {o.isRecurring ? ' · mensual' : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="font-black tabular-nums">{money(o.amount)}</p>
                      {!o.done && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => remove(o)}
                            aria-label={`Eliminar ${o.name}`}
                            className="grid h-7 w-7 place-items-center rounded-lg border-2 border-[#111] bg-white"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSettling(o)}
                            className="paper-opaque rounded-lg border-2 border-[#111] bg-[#FFD83D] px-2.5 py-1 text-xs font-black"
                          >
                            {T.settle}
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          );
        })()
      )}

      {adding !== null && (
        <ObligationSheet
          businessId={businessId}
          type={type}
          parties={parties}
          presetParty={adding}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            load();
          }}
        />
      )}
      {settling && (
        <SettleSheet
          businessId={businessId}
          obligation={settling}
          onClose={() => setSettling(null)}
          onDone={() => {
            setSettling(null);
            toast.showSuccess(type === 'cobro' ? 'Cobro registrado.' : 'Pago registrado.');
            load();
          }}
        />
      )}
    </div>
  );
}
