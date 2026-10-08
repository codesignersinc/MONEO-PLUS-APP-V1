'use client';
import React, { useEffect, useState } from 'react';
import { AccountSelect, SubmitButton } from '@/components/finance/formKit';
import { accountsService } from '@/lib/supabaseFinance';
import { getFxContext, type FxContext } from '@/lib/supabaseCurrency';
import { getRateFromMap } from '@/lib/currency';
import { todayLocal } from '@/lib/dates';
import { getErrorMessage } from '@/lib/dataError';
import type { Account } from '@/lib/financeStore';
import type { Household, HouseholdSettlement } from '@/lib/household';
import {
  discardOwnMovement,
  householdService,
  householdSettlementsService,
  recordOwnMovement,
} from '@/lib/supabaseHousehold';
import { ErrorNote, Sheet } from '@/components/household/ui';
import { moneyFormatter } from '@/components/dashboard/ui';
import { formatMoney } from '@/lib/format';

// One side of a settlement confirms it: the payer with an expense in their own account,
// the receiver with an income in theirs (or without a movement, if it happened outside
// MONEO). Nobody ever touches the other person's account.
export default function SettleSheet({
  household,
  settlement,
  side,
  otherName,
  myName,
  onClose,
  onDone,
}: {
  household: Household;
  settlement: HouseholdSettlement;
  side: 'pay' | 'receive';
  otherName: string;
  myName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [accountId, setAccountId] = useState('');
  const [fx, setFx] = useState<FxContext>({ baseCurrency: 'PEN', ratesMap: {} });
  const [withMovement, setWithMovement] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([accountsService.getAll(), getFxContext()])
      .then(([accs, f]) => {
        setAccounts(accs);
        setAccountId((cur) => cur || accs[0]?.id || '');
        setFx(f);
      })
      .catch(() => setAccounts([]));
  }, []);

  const account = accounts?.find((a) => a.id === accountId) ?? null;
  const accCurrency = account?.currency || household.baseCurrency;
  const accAmount =
    Math.round(
      settlement.amount * getRateFromMap(fx.ratesMap, household.baseCurrency, accCurrency) * 100
    ) / 100;
  const amountText = moneyFormatter(household.baseCurrency)(settlement.amount);

  const confirm = async () => {
    if (withMovement && !account) return setError('Elige tu cuenta.');
    setSaving(true);
    setError('');
    let created: string | null = null;
    try {
      if (withMovement && account) {
        created = await recordOwnMovement({
          account,
          type: side === 'pay' ? 'gasto' : 'ingreso',
          amount: accAmount,
          name:
            side === 'pay'
              ? `Compensación hogar a ${otherName}`
              : `Compensación hogar de ${otherName}`,
          category: side === 'pay' ? 'Hogar' : 'Ingreso',
          categoryIcon: side === 'pay' ? '🛋️' : '💼',
          date: todayLocal(),
          fx,
        });
      }
      if (side === 'pay') await householdSettlementsService.confirmPaid(settlement.id, created);
      else await householdSettlementsService.confirmReceived(settlement.id, created);
      householdService.notify(
        household.id,
        'household_settlement',
        side === 'pay' ? 'Compensación pagada' : 'Compensación recibida',
        side === 'pay'
          ? `${myName} confirmó que pagó la compensación del hogar.`
          : `${myName} confirmó que recibió la compensación del hogar.`
      );
      onDone();
    } catch (err) {
      if (created) await discardOwnMovement(created);
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Sheet
      title={side === 'pay' ? 'Confirmar que pagué' : 'Confirmar que recibí'}
      onClose={onClose}
      busy={saving}
    >
      <p className="text-[16px] font-bold text-[#111]">
        {side === 'pay'
          ? `Pagaste ${amountText} a ${otherName} para equilibrar el hogar.`
          : `Recibiste ${amountText} de ${otherName} para equilibrar el hogar.`}
      </p>
      <label className="flex items-start gap-3 rounded-2xl border-2 border-[#111]/15 bg-white p-3 text-[15px] font-black text-[#111]">
        <input
          type="checkbox"
          checked={withMovement}
          onChange={(e) => setWithMovement(e.target.checked)}
          className="mt-0.5 h-5 w-5 accent-[#111]"
        />
        <span>
          {side === 'pay' ? 'Registrar el gasto en mi cuenta' : 'Registrar el ingreso en mi cuenta'}
          <span className="block text-xs font-semibold text-gray-600">
            Solo se mueve tu cuenta. {otherName} confirma por su lado con la suya.
          </span>
        </span>
      </label>
      {withMovement && (
        <>
          <AccountSelect
            accounts={accounts}
            value={accountId}
            onChange={setAccountId}
            label={side === 'pay' ? 'Cuenta desde la que pagué' : 'Cuenta donde recibí'}
          />
          {account && accCurrency !== household.baseCurrency && (
            <p className="-mt-2 text-xs font-bold text-gray-600">
              Se registrará {formatMoney(accAmount, accCurrency)} en tu cuenta en {accCurrency}.
            </p>
          )}
        </>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      <SubmitButton onClick={confirm} disabled={saving || (withMovement && accounts === null)}>
        {saving ? 'Guardando…' : 'Confirmar'}
      </SubmitButton>
    </Sheet>
  );
}
