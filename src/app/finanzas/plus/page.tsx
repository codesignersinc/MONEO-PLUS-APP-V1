'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Crown, Loader2 } from 'lucide-react';
import LoadError from '@/components/ui/LoadError';
import CheckoutPanel from '@/components/billing/CheckoutPanel';
import { useToast } from '@/components/ui/Toast';
import { usePlus } from '@/contexts/PlusContext';
import {
  PLUS_BENEFITS,
  annualSavingsPercent,
  billingService,
  plansService,
  trialDaysLeft,
  type BillingPlan,
  type PlanCode,
} from '@/lib/billing';
import { track } from '@/lib/analytics';

// MONEO PLUS plans and checkout inside the app (from the trial countdown, locked features,
// the sidebar card). Subscriptions renew on a card; passes and lifetime are paid once with
// card, Yape or PagoEfectivo.

const money = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });

function priceLine(p: BillingPlan): string {
  if (p.kind === 'subscription')
    return `${money(p.price)} / ${p.intervalMonths === 12 ? 'año' : 'mes'}`;
  if (p.kind === 'pass') return `${money(p.price)} · ${p.intervalMonths} meses`;
  return `${money(p.price)} · una vez`;
}

function subLine(p: BillingPlan, monthly?: BillingPlan): string {
  if (p.kind === 'subscription')
    return p.intervalMonths === 12 && monthly
      ? `${money(p.price / 12)} al mes · ahorra ${annualSavingsPercent(monthly.price, p.price)}%`
      : 'Se renueva cada mes';
  if (p.kind === 'pass')
    return `${money(p.price / (p.intervalMonths ?? 1))} al mes · sin renovación`;
  return p.code === 'founder' ? 'Precio de lanzamiento' : 'Para siempre · sin renovaciones';
}

export default function PlusPage() {
  const toast = useToast();
  const { ent, paid, refresh } = usePlus();
  const [plans, setPlans] = useState<BillingPlan[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [selected, setSelected] = useState<PlanCode | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = () => {
    setLoadError(null);
    plansService
      .list()
      .then((list) => {
        setPlans(list);
        setSelected(
          (s) =>
            s ?? (list.some((p) => p.code === 'pass_12m') ? 'pass_12m' : (list[0]?.code ?? null))
        );
      })
      .catch(setLoadError);
  };
  useEffect(() => {
    load();
    track('paywall_viewed', { from: 'app' });
  }, []);

  const monthly = plans?.find((p) => p.code === 'plus_monthly');
  const groups = useMemo(() => {
    const list = plans ?? [];
    return {
      once: list.filter((p) => p.kind === 'pass' || p.kind === 'one_time'),
      subs: list.filter((p) => p.kind === 'subscription'),
    };
  }, [plans]);
  const plan = plans?.find((p) => p.code === selected) ?? null;
  const days = trialDaysLeft(ent ?? null);
  const trial = Boolean(
    plan && plan.kind === 'subscription' && plan.trialDays > 0 && !ent?.hadTrial
  );

  const cancel = async () => {
    if (
      !window.confirm('¿Cancelar tu suscripción? Conservas PLUS hasta el final del periodo pagado.')
    )
      return;
    setCancelling(true);
    try {
      await billingService.cancel();
      await refresh();
      toast.showSuccess('Suscripción cancelada. No habrá más cobros.');
    } catch (err) {
      toast.showError(err);
    } finally {
      setCancelling(false);
    }
  };

  if (loadError) return <LoadError what="los planes" error={loadError} onRetry={load} />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-6 flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-[3px] border-[#111] bg-[#FFD83D]">
          <Crown className="h-6 w-6" strokeWidth={2.4} />
        </span>
        <div>
          <h1 className="text-[28px] font-black leading-tight text-[#111]">
            MONEO <span className="rounded bg-[#FFD83D] px-1.5">PLUS</span>
          </h1>
          <p className="text-sm font-semibold text-gray-700">
            {days !== null
              ? `Estás en tu prueba gratis: ${days === 0 ? 'hoy es el último día' : `te quedan ${days} días`}. Elige cómo seguir.`
              : paid && ent
                ? ent.lifetime
                  ? 'Tienes MONEO PLUS de por vida.'
                  : ent.currentPeriodEnd
                    ? `Tienes MONEO PLUS hasta el ${fmtDate(ent.currentPeriodEnd)}.`
                    : 'Tienes MONEO PLUS.'
                : 'Registra solo, entiende tu dinero y ahorra más.'}
          </p>
        </div>
      </div>

      {paid && ent?.kind === 'subscription' && ent.status !== 'cancelled' && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#111] bg-white p-4">
          <p className="text-sm font-semibold text-gray-800">
            Suscripción activa
            {ent.currentPeriodEnd ? ` · próximo cobro: ${fmtDate(ent.currentPeriodEnd)}` : ''}
          </p>
          <button
            type="button"
            onClick={cancel}
            disabled={cancelling}
            className="flex items-center gap-2 text-sm font-black text-gray-700 underline disabled:opacity-50"
          >
            {cancelling && <Loader2 className="h-4 w-4 animate-spin" />} Cancelar suscripción
          </button>
        </div>
      )}

      {ent?.lifetime ? null : !plans ? (
        <p className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando planes…
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <div className="space-y-5">
            <PlanGroup
              title="Pago único"
              hint="Tarjeta, Yape o efectivo · sin renovaciones"
              plans={groups.once}
              selected={selected}
              onSelect={setSelected}
              monthly={monthly}
            />
            <PlanGroup
              title="Suscripción"
              hint="Con tarjeta · se renueva sola · cancela cuando quieras"
              plans={groups.subs}
              selected={selected}
              onSelect={setSelected}
              monthly={monthly}
            />
            <ul className="grid gap-1.5 rounded-2xl border-2 border-[#111] bg-[#FFF9EC] p-4 sm:grid-cols-2">
              {PLUS_BENEFITS.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm font-semibold text-[#111]">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#45D98B]">
                    <Check className="h-3 w-3" strokeWidth={3.5} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:sticky lg:top-6 lg:self-start">
            {plan && (
              <>
                <p className="mb-2 text-sm font-black text-[#111]">
                  {plan.name} · {priceLine(plan)}{' '}
                  <span className="font-semibold text-gray-600">(IGV incluido)</span>
                </p>
                <CheckoutPanel
                  plan={plan}
                  trial={trial}
                  onApproved={() => {
                    track(plan.kind === 'pass' ? 'pass_purchased' : 'subscription_started', {
                      plan: plan.code,
                    });
                    refresh();
                    toast.showSuccess('¡MONEO PLUS está activo!');
                  }}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanGroup({
  title,
  hint,
  plans,
  selected,
  onSelect,
  monthly,
}: {
  title: string;
  hint: string;
  plans: BillingPlan[];
  selected: PlanCode | null;
  onSelect: (c: PlanCode) => void;
  monthly?: BillingPlan;
}) {
  if (plans.length === 0) return null;
  return (
    <section>
      <h2 className="text-lg font-black text-[#111]">{title}</h2>
      <p className="mb-2 text-xs font-semibold text-gray-600">{hint}</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {plans.map((p) => {
          const on = p.code === selected;
          return (
            <button
              key={p.code}
              type="button"
              onClick={() => onSelect(p.code)}
              aria-pressed={on}
              className={`relative rounded-2xl border-[3px] border-[#111] p-4 text-left transition-transform hover:-translate-y-0.5 ${on ? 'bg-[#FFD83D] shadow-[4px_4px_0_#111]' : 'bg-white shadow-[2px_2px_0_#111]'}`}
            >
              {p.code === 'pass_12m' && (
                <span className="absolute -top-3 right-3 rounded-full border-2 border-[#111] bg-[#45D98B] px-2 text-[11px] font-black">
                  MÁS ELEGIDO
                </span>
              )}
              <p className="font-black text-[#111]">{p.name}</p>
              <p className="text-lg font-black text-[#111]">{priceLine(p)}</p>
              <p className="text-xs font-semibold text-gray-700">{subLine(p, monthly)}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
