'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, Plus, Search } from 'lucide-react';
import LoadError from '@/components/ui/LoadError';
import { card } from '@/components/dashboard/ui';
import ContextSwitch from '@/components/business/ContextSwitch';
import { useNegocio } from '@/components/business/useNegocio';
import { Initials, KIND_LABEL, Sheet, field, label } from '@/components/business/kit';
import { formatMoney } from '@/lib/format';
import { getErrorMessage } from '@/lib/dataError';
import { useDataChanged } from '@/lib/dataSync';
import {
  bizObligationsService,
  partiesService,
  type BizObligation,
  type Party,
  type PartyKind,
} from '@/lib/supabaseBusiness';
import { userSettingsService } from '@/lib/supabaseCurrency';

// Directory of a business (fase 4): suppliers, customers and team in one searchable list.
// Not a CRM: name, how to reach them, and what is pending with each one.

const COLORS: Record<PartyKind, string> = {
  cliente: '#45D98B',
  proveedor: '#FF806E',
  empleado: '#B99CFF',
};

export default function BusinessContactsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { businesses } = useNegocio();
  const business = businesses.find((b) => b.id === id);
  const [parties, setParties] = useState<Party[] | null>(null);
  const [pending, setPending] = useState<BizObligation[]>([]);
  const [currency, setCurrency] = useState('PEN');
  const [error, setError] = useState<unknown>(null);
  const [kind, setKind] = useState<PartyKind | 'todos'>('todos');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    kind: 'cliente' as PartyKind,
    name: '',
    phone: '',
    email: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      partiesService.list(id),
      bizObligationsService.list(id),
      userSettingsService.get(),
    ])
      .then(([p, o, s]) => {
        setParties(p);
        setPending(o.filter((x) => !x.done));
        setCurrency(s.baseCurrencyCode);
      })
      .catch(setError);
  }, [id]);
  useEffect(load, [load]);
  useDataChanged(load);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (parties ?? [])
      .filter(
        (p) => (kind === 'todos' || p.kind === kind) && (!q || p.name.toLowerCase().includes(q))
      )
      .map((p) => ({
        party: p,
        pending: pending.filter((o) => o.partyId === p.id).reduce((a, o) => a + o.amount, 0),
      }));
  }, [parties, pending, kind, query]);

  const create = async () => {
    setFormError('');
    if (!form.name.trim()) return setFormError('Escribe el nombre.');
    setSaving(true);
    try {
      const p = await partiesService.create(id, {
        kind: form.kind,
        name: form.name,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      });
      router.push(`/finanzas/negocio/${id}/contactos/${p.id}`);
    } catch (e) {
      setFormError(getErrorMessage(e));
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <LoadError what="tus contactos" error={error} onRetry={load} />
      </div>
    );
  }

  const count = (k: PartyKind) => (parties ?? []).filter((p) => p.kind === k).length;
  const chip = (k: PartyKind | 'todos', text: string) => (
    <button
      key={k}
      type="button"
      aria-pressed={kind === k}
      onClick={() => setKind(k)}
      className={`shrink-0 rounded-xl border-2 border-[#111] px-3 py-1.5 text-xs font-black ${
        kind === k ? 'paper-opaque bg-[#111] text-white' : 'bg-white'
      }`}
    >
      {text}
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-5 text-[#111] lg:px-8 lg:py-6">
      <ContextSwitch className="mb-4 lg:hidden" />
      <Link
        href={`/finanzas/negocio/${id}`}
        className="mb-3 inline-flex items-center gap-1 text-sm font-black"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.8} /> {business?.name ?? 'Negocio'}
      </Link>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h1 className="text-[28px] font-black leading-tight">Contactos</h1>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="paper-opaque inline-flex items-center gap-1.5 rounded-xl border-2 border-[#111] bg-[#FFD83D] px-3 py-2 text-sm font-black shadow-[0_3px_0_#111]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Agregar
        </button>
      </div>

      <label className="relative mb-3 block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#111]/50" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre"
          aria-label="Buscar contactos"
          className={`${field} pl-9`}
        />
      </label>
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {chip('todos', `Todos · ${parties?.length ?? 0}`)}
        {chip('cliente', `Clientes · ${count('cliente')}`)}
        {chip('proveedor', `Proveedores · ${count('proveedor')}`)}
        {chip('empleado', `Equipo · ${count('empleado')}`)}
      </div>

      {!parties ? (
        <div className="h-32 animate-pulse rounded-[22px] border-2 border-[#111]/20 bg-white" />
      ) : rows.length === 0 ? (
        <p className={`${card} p-5 text-sm font-bold`}>
          {parties.length === 0
            ? 'Aún no tienes contactos. Se agregan solos cuando registras un cobro o un pago con un nombre, o aquí con «Agregar».'
            : 'Nadie coincide con la búsqueda.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ party, pending: owed }) => (
            <li key={party.id}>
              <Link
                href={`/finanzas/negocio/${id}/contactos/${party.id}`}
                className={`${card} flex items-center gap-3 p-4 hover:-translate-y-px`}
              >
                <Initials name={party.name} color={COLORS[party.kind]} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black">{party.name}</p>
                  <p className="truncate text-xs font-semibold text-[#111]/60">
                    {KIND_LABEL[party.kind]}
                    {party.phone ? ` · ${party.phone}` : ''}
                    {!party.active ? ' · inactivo' : ''}
                  </p>
                </div>
                {owed > 0 && (
                  <span
                    className={`text-sm font-black tabular-nums ${party.kind === 'cliente' ? 'text-[#15803D]' : 'text-[#B42318]'}`}
                  >
                    {formatMoney(owed, currency)}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2.5} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <Sheet title="Nuevo contacto" onClose={() => setAdding(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1 rounded-2xl border-2 border-[#111] bg-white p-1">
              {(['cliente', 'proveedor', 'empleado'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={form.kind === k}
                  onClick={() => setForm({ ...form, kind: k })}
                  className={`rounded-xl py-2 text-xs font-black ${form.kind === k ? 'paper-opaque bg-[#111] text-white' : ''}`}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            {form.kind === 'empleado' && (
              <p className="rounded-xl bg-[#FFF3C4] px-3 py-2 text-xs font-bold">
                Para un empleado con sueldo mensual usa «Equipo»: así se crea su pago de cada mes.
              </p>
            )}
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
                <span className={label}>Teléfono (opcional)</span>
                <input
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={field}
                />
              </label>
              <label className="block">
                <span className={label}>Correo (opcional)</span>
                <input
                  inputMode="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={field}
                />
              </label>
            </div>
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
            onClick={create}
            disabled={saving}
            className="paper-opaque mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] py-3.5 text-base font-black shadow-[0_4px_0_#111] disabled:opacity-60"
          >
            {saving && <Loader2 className="h-5 w-5 animate-spin" />} Guardar
          </button>
        </Sheet>
      )}
    </div>
  );
}
