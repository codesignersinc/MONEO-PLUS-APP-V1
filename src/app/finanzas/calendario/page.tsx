'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { transactionsService, subscriptionsService } from '@/lib/supabaseFinance';
import type { Transaction, Subscription } from '@/lib/financeStore';
import LoadError from '@/components/ui/LoadError';
import { toDataError } from '@/lib/dataError';
import { useDataChanged } from '@/lib/dataSync';
import { formatMoney, monthNames } from '@/lib/format';
import { X } from 'lucide-react';
import Glyph from '@/components/ui/Glyph';
import type { GlyphKey } from '@/lib/glyphs';

const DAYS_HEADER = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

const MONTHS = monthNames('long', { capitalize: true });

interface PagoEntry {
  id: string;
  name: string;
  amount: number;
  categoryIcon: string;
  paymentDate: string;
  status: 'pendiente' | 'pagado' | 'vencido';
}

interface SavingsGoal {
  id: string;
  name: string;
  icon: string;
  targetDate: string;
  target: number;
  current: number;
}

interface CalendarEvent {
  id: string;
  label: string;
  amount?: number;
  icon: string;
  kind: 'gasto' | 'ingreso' | 'transferencia' | 'suscripcion' | 'pago' | 'meta';
}

type EventMap = Record<number, CalendarEvent[]>;

interface PagoRow {
  id: string;
  name: string;
  amount: number;
  category_icon: string;
  payment_date: string;
  status: PagoEntry['status'];
}

interface SavingsGoalRow {
  id: string;
  name: string;
  icon: string;
  target_date: string;
  target_amount: number;
  current_amount: number;
}

const KIND_CONFIG: Record<
  string,
  { bg: string; text: string; border: string; badge: string; glyph: GlyphKey }
> = {
  ingreso: {
    bg: '#DCFCE7',
    text: '#15803D',
    border: '#16A34A',
    badge: 'bg-green-500',
    glyph: 'coins',
  },
  gasto: { bg: '#FEE2E2', text: '#B91C1C', border: '#DC2626', badge: 'bg-red-500', glyph: 'cash' },
  transferencia: {
    bg: '#DBEAFE',
    text: '#1D4ED8',
    border: '#2563EB',
    badge: 'bg-blue-500',
    glyph: 'repeat',
  },
  suscripcion: {
    bg: '#F3E8FF',
    text: '#7E22CE',
    border: '#9333EA',
    badge: 'bg-purple-500',
    glyph: 'phone',
  },
  pago: {
    bg: '#FEF3C7',
    text: '#B45309',
    border: '#D97706',
    badge: 'bg-amber-500',
    glyph: 'clipboard',
  },
  meta: {
    bg: '#ECFDF5',
    text: '#065F46',
    border: '#059669',
    badge: 'bg-emerald-600',
    glyph: 'target',
  },
};

function formatAmount(amount: number): string {
  return `${formatMoney(Math.abs(amount))}`;
}

export default function CalendarioPage() {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [eventMap, setEventMap] = useState<EventMap>({});
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('todos');
  const [loadError, setLoadError] = useState<unknown>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const supabase = createClient();

      const [transactions, subscriptions, pagosRes, savingsRes] = await Promise.all([
        transactionsService.getAll(),
        subscriptionsService.getAll(),
        supabase
          .from('pagos')
          .select('id,name,amount,category_icon,payment_date,status')
          .order('payment_date'),
        supabase
          .from('savings_goals')
          .select('id,name,icon,target_date,target_amount,current_amount'),
      ]);
      if (pagosRes.error) throw toDataError(pagosRes.error);
      if (savingsRes.error) throw toDataError(savingsRes.error);

      const pagos: PagoEntry[] = (pagosRes.data || []).map((r: PagoRow) => ({
        id: r.id,
        name: r.name,
        amount: r.amount,
        categoryIcon: r.category_icon,
        paymentDate: r.payment_date,
        status: r.status,
      }));

      const savings: SavingsGoal[] = (savingsRes.data || []).map((r: SavingsGoalRow) => ({
        id: r.id,
        name: r.name,
        icon: r.icon,
        targetDate: r.target_date,
        target: r.target_amount,
        current: r.current_amount,
      }));

      const map: EventMap = {};

      const addEvent = (day: number, ev: CalendarEvent) => {
        if (!map[day]) map[day] = [];
        map[day].push(ev);
      };

      transactions.forEach((tx: Transaction) => {
        const d = new Date(tx.date + 'T12:00:00');
        if (d.getMonth() === month && d.getFullYear() === year) {
          addEvent(d.getDate(), {
            id: tx.id,
            label: tx.name,
            amount: tx.amount,
            icon: tx.categoryIcon || KIND_CONFIG[tx.type].glyph,
            kind: tx.type,
          });
        }
      });

      subscriptions.forEach((sub: Subscription) => {
        if (!sub.active) return;
        let day: number | null = null;
        if (sub.nextPaymentDate) {
          const d = new Date(sub.nextPaymentDate + 'T12:00:00');
          if (d.getMonth() === month && d.getFullYear() === year) day = d.getDate();
        } else if (sub.paymentDay) {
          day = sub.paymentDay;
        }
        if (day && day >= 1 && day <= 31) {
          addEvent(day, {
            id: sub.id,
            label: sub.name,
            amount: sub.amount,
            icon: sub.icon || 'phone',
            kind: 'suscripcion',
          });
        }
      });

      pagos.forEach((p: PagoEntry) => {
        if (!p.paymentDate) return;
        const d = new Date(p.paymentDate + 'T12:00:00');
        if (d.getMonth() === month && d.getFullYear() === year) {
          addEvent(d.getDate(), {
            id: p.id,
            label: p.name,
            amount: p.amount,
            icon: p.categoryIcon || 'clipboard',
            kind: 'pago',
          });
        }
      });

      savings.forEach((g: SavingsGoal) => {
        if (!g.targetDate) return;
        const d = new Date(g.targetDate + 'T12:00:00');
        if (d.getMonth() === month && d.getFullYear() === year) {
          addEvent(d.getDate(), {
            id: g.id,
            label: g.name,
            amount: g.target,
            icon: g.icon || 'target',
            kind: 'meta',
          });
        }
      });

      setEventMap(map);
    } catch (e) {
      console.error(e);
      setEventMap({});
      setLoadError(e);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  // Reload when something is added from the quick-add sheet or the global modal.
  useDataChanged(loadAllData);

  useEffect(() => {
    loadAllData();
    setSelectedDay(new Date().getDate());
  }, [loadAllData]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

  const prevMonth = () => {
    setSelectedDay(null);
    setViewDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setSelectedDay(null);
    setViewDate(new Date(year, month + 1, 1));
  };

  const selectedEvents = selectedDay ? eventMap[selectedDay] || [] : [];
  const filteredEvents =
    activeFilter === 'todos'
      ? selectedEvents
      : selectedEvents.filter((e) => e.kind === activeFilter);

  const kindCounts: Record<string, number> = {};
  Object.values(eventMap)
    .flat()
    .forEach((e) => {
      kindCounts[e.kind] = (kindCounts[e.kind] || 0) + 1;
    });

  const FILTERS: { key: string; label: string; glyph: GlyphKey }[] = [
    { key: 'todos', label: 'Todo', glyph: 'calendar' },
    { key: 'ingreso', label: 'Ingresos', glyph: 'coins' },
    { key: 'gasto', label: 'Gastos', glyph: 'cash' },
    { key: 'suscripcion', label: 'Suscripciones', glyph: 'phone' },
    { key: 'pago', label: 'Pagos', glyph: 'clipboard' },
    { key: 'meta', label: 'Metas', glyph: 'target' },
  ];

  // A failed load must not render an empty calendar ("Sin eventos este día").
  if (loadError) {
    return (
      <div className="px-3 lg:px-8 py-5 max-w-2xl mx-auto">
        <h1
          className="text-3xl font-black text-black uppercase tracking-tight mb-5 flex items-center gap-2"
          style={{ fontFamily: 'monospace' }}
        >
          <Glyph name="calendar" className="h-7 w-7" />
          CALENDARIO
        </h1>
        <LoadError what="tu calendario" error={loadError} onRetry={loadAllData} />
      </div>
    );
  }

  return (
    <div className="px-3 lg:px-8 py-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1
          className="text-3xl font-black text-black uppercase tracking-tight flex items-center gap-2"
          style={{ fontFamily: 'monospace' }}
        >
          <Glyph name="calendar" className="h-7 w-7" />
          CALENDARIO
        </h1>
        <p className="text-sm font-bold text-gray-500 mt-0.5">Mapa visual de tus finanzas</p>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center justify-between mb-4 rounded-2xl border-[3px] border-black bg-[#FFD43B] shadow-[4px_4px_0px_#000] px-4 py-3">
        <button
          onClick={prevMonth}
          className="w-9 h-9 rounded-xl border-[2px] border-black bg-white flex items-center justify-center font-black text-lg hover:bg-black hover:text-[#FFD43B] transition-colors"
        >
          ‹
        </button>
        <span
          className="text-xl font-black uppercase tracking-widest"
          style={{ fontFamily: 'monospace' }}
        >
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="w-9 h-9 rounded-xl border-[2px] border-black bg-white flex items-center justify-center font-black text-lg hover:bg-black hover:text-[#FFD43B] transition-colors"
        >
          ›
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(KIND_CONFIG).map(([kind, cfg]) => {
          const count = kindCounts[kind] || 0;
          if (count === 0) return null;
          return (
            <div
              key={kind}
              className="flex items-center gap-1 rounded-full border-[2px] border-black px-2 py-0.5 text-xs font-bold"
              style={{ background: cfg.bg, color: cfg.text }}
            >
              <Glyph name={cfg.glyph} className="h-3.5 w-3.5" />
              <span className="capitalize">{kind}</span>
              <span className="bg-black text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Calendar Grid */}
      <div className="rounded-2xl border-[3px] border-black bg-[#FAFAF8] shadow-[6px_6px_0px_#000] mb-5 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b-[3px] border-black">
          {DAYS_HEADER.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-black py-2 border-r-[2px] border-black last:border-r-0 bg-black text-[#FFD43B] tracking-widest"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (!day) {
              return (
                <div
                  key={`empty-${i}`}
                  className="aspect-square border-r-[2px] border-b-[2px] border-black last:border-r-0 bg-gray-100"
                />
              );
            }

            const events = eventMap[day] || [];
            const isSelected = selectedDay === day;
            const isToday = isCurrentMonth && day === today.getDate();

            const kinds = [...new Set(events.map((e) => e.kind))];

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`aspect-square border-r-[2px] border-b-[2px] border-black last:border-r-0 flex flex-col items-center justify-start pt-1 pb-1 relative transition-all group
                  ${isSelected ? 'bg-black text-[#FFD43B]' : isToday ? 'bg-[#FFD43B]' : 'bg-[#FAFAF8] hover:bg-[#FFF9E6]'}
                `}
              >
                <span
                  className={`text-xs font-black leading-none ${isSelected ? 'text-[#FFD43B]' : isToday ? 'text-black' : 'text-black'}`}
                >
                  {day}
                </span>

                {/* Event dots */}
                {kinds.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-[2px] mt-[3px] px-0.5">
                    {kinds.slice(0, 4).map((kind, ki) => (
                      <div
                        key={ki}
                        className="w-[5px] h-[5px] rounded-full border border-black"
                        style={{
                          background: isSelected ? '#FFD43B' : KIND_CONFIG[kind]?.border || '#000',
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Event count badge */}
                {events.length > 0 && (
                  <div
                    className={`absolute top-0.5 right-0.5 text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-black
                    ${isSelected ? 'bg-[#FFD43B] text-black' : 'bg-black text-[#FFD43B]'}`}
                  >
                    {events.length}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Panel */}
      {selectedDay && (
        <div className="rounded-2xl border-[3px] border-black bg-[#FAFAF8] shadow-[6px_6px_0px_#000] overflow-hidden">
          {/* Panel Header */}
          <div className="border-b-[3px] border-black bg-black px-4 py-3 flex items-center justify-between rounded-t-xl">
            <div>
              <span
                className="text-[#FFD43B] font-black text-lg"
                style={{ fontFamily: 'monospace' }}
              >
                {String(selectedDay).padStart(2, '0')} {MONTHS[month].toUpperCase().slice(0, 3)}{' '}
                {year}
              </span>
              <span className="text-gray-400 text-xs font-bold ml-3">
                {selectedEvents.length} evento{selectedEvents.length !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              aria-label="Cerrar"
              className="text-[#FFD43B] font-black text-xl hover:text-white transition-colors"
            >
              <X className="h-6 w-6" strokeWidth={2.5} aria-hidden />
            </button>
          </div>

          {/* Filter tabs */}
          {selectedEvents.length > 0 && (
            <div className="flex overflow-x-auto border-b-[3px] border-black bg-[#F5F5F0]">
              {FILTERS.map((f) => {
                const count =
                  f.key === 'todos'
                    ? selectedEvents.length
                    : selectedEvents.filter((e) => e.kind === f.key).length;
                if (f.key !== 'todos' && count === 0) return null;
                return (
                  <button
                    key={f.key}
                    onClick={() => setActiveFilter(f.key)}
                    className={`flex-shrink-0 px-3 py-2 text-xs font-black border-r-[2px] border-black transition-colors
                      ${activeFilter === f.key ? 'bg-[#FFD43B] text-black' : 'bg-transparent text-gray-600 hover:bg-[#FFF9E6]'}`}
                  >
                    <Glyph name={f.glyph} className="mr-1 inline-block h-3.5 w-3.5 align-[-2px]" />
                    {f.label}
                    {count > 0 && (
                      <span
                        className={`ml-1 text-[10px] px-1 rounded border border-black font-black
                        ${activeFilter === f.key ? 'bg-black text-[#FFD43B]' : 'bg-gray-200 text-black'}`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Events list */}
          <div className="divide-y-[2px] divide-black">
            {loading ? (
              <div className="p-8 text-center">
                <Glyph name="settings" className="h-6 w-6 animate-spin inline-block" />
                <p className="text-xs font-bold text-gray-500 mt-2">Cargando...</p>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="p-8 text-center">
                <Glyph name="inbox" className="h-10 w-10 mx-auto mb-3 text-[#111]" />
                <p className="font-black text-gray-500 text-sm uppercase tracking-wide">
                  Sin eventos este día
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Registra gastos, ingresos o pagos para verlos aquí
                </p>
              </div>
            ) : (
              filteredEvents.map((ev, i) => {
                const cfg = KIND_CONFIG[ev.kind];
                return (
                  <div
                    key={`${ev.id}-${i}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[#FFF9E6] transition-colors"
                    style={{ borderLeft: `4px solid ${cfg.border}` }}
                  >
                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-xl border-[2px] border-black flex items-center justify-center text-lg flex-shrink-0 font-black"
                      style={{ background: cfg.bg }}
                    >
                      <Glyph name={ev.icon} fallback={cfg.glyph} className="h-5 w-5 text-[#111]" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-black truncate">{ev.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className="text-[10px] font-black px-1.5 py-0.5 rounded border border-black uppercase tracking-wide"
                          style={{ background: cfg.bg, color: cfg.text }}
                        >
                          {ev.kind}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    {ev.amount !== undefined && (
                      <div className="text-right flex-shrink-0">
                        <p
                          className="font-black text-sm"
                          style={{
                            color:
                              ev.kind === 'ingreso'
                                ? '#15803D'
                                : ev.kind === 'gasto'
                                  ? '#B91C1C'
                                  : cfg.text,
                          }}
                        >
                          {ev.kind === 'ingreso' ? '+' : ev.kind === 'gasto' ? '-' : ''}
                          {formatAmount(ev.amount)}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Day summary footer */}
          {filteredEvents.length > 0 &&
            (() => {
              const gastos = selectedEvents
                .filter((e) => e.kind === 'gasto')
                .reduce((s, e) => s + (e.amount || 0), 0);
              const ingresos = selectedEvents
                .filter((e) => e.kind === 'ingreso')
                .reduce((s, e) => s + (e.amount || 0), 0);
              const pagos = selectedEvents
                .filter((e) => e.kind === 'pago' || e.kind === 'suscripcion')
                .reduce((s, e) => s + (e.amount || 0), 0);
              if (gastos === 0 && ingresos === 0 && pagos === 0) return null;
              return (
                <div className="border-t-[3px] border-black bg-black px-4 py-3 flex flex-wrap gap-4 rounded-b-xl">
                  {ingresos > 0 && (
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Ingresos</p>
                      <p className="text-sm font-black text-green-400">+{formatAmount(ingresos)}</p>
                    </div>
                  )}
                  {gastos > 0 && (
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Gastos</p>
                      <p className="text-sm font-black text-red-400">-{formatAmount(gastos)}</p>
                    </div>
                  )}
                  {pagos > 0 && (
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Pagos/Subs</p>
                      <p className="text-sm font-black text-amber-400">{formatAmount(pagos)}</p>
                    </div>
                  )}
                  {ingresos > 0 && gastos > 0 && (
                    <div className="text-center ml-auto">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Balance</p>
                      <p
                        className={`text-sm font-black ${ingresos - gastos >= 0 ? 'text-green-400' : 'text-red-400'}`}
                      >
                        {ingresos - gastos >= 0 ? '+' : ''}
                        {formatAmount(ingresos - gastos)}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
        </div>
      )}

      {/* Hint when nothing selected */}
      {!selectedDay && !loading && (
        <div className="rounded-2xl border-[3px] border-black border-dashed p-6 text-center bg-[#FAFAF8]">
          <Glyph name="pointer" className="h-8 w-8 mx-auto mb-2 text-[#111]" />
          <p className="font-black text-sm text-gray-600 uppercase tracking-wide">
            Toca un día para ver sus eventos
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Gastos · Ingresos · Pagos · Suscripciones · Metas
          </p>
        </div>
      )}
    </div>
  );
}
