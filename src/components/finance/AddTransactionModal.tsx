'use client';
import React, { useState, useEffect } from 'react';
import { accountsService, transactionsService } from '@/lib/supabaseFinance';
import { userSettingsService, exchangeRatesService } from '@/lib/supabaseCurrency';
import {
  buildCurrencyFields,
  getCurrencyInfo,
  formatCurrency,
  getRateFromMap,
} from '@/lib/currency';
import { CATEGORY_PRESETS, type Account } from '@/lib/financeStore';
import {
  AccountSelect,
  AmountField,
  CategoryChips,
  DateField,
  FormHero,
  NotesField,
  SubmitButton,
  TextField,
} from '@/components/finance/formKit';
import { getErrorMessage } from '@/lib/dataError';
import TransferForm from '@/components/finance/TransferForm';
import { notifyDataChanged } from '@/lib/dataSync';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  // Tab shown when it opens (Home "+ Nuevo" / quick actions).
  initialTab?: TabType;
}

type TabType = 'gasto' | 'ingreso' | 'transferencia';

export default function AddTransactionModal({
  isOpen,
  onClose,
  onSaved,
  initialTab,
}: AddTransactionModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('gasto');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORY_PRESETS[0].id);
  const [accountId, setAccountId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState('PEN');
  const [ratesMap, setRatesMap] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      setLoadError('');
      setSaveError('');
      setAccountId('');
      setAccounts(null);
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setDate(`${yyyy}-${mm}-${dd}`);

      Promise.all([
        accountsService.getAll(),
        userSettingsService.get(),
        exchangeRatesService.getRatesMap(),
      ])
        .then(([accs, settings, rates]) => {
          setAccounts(accs);
          // First registered account preselected; the user can change it.
          setAccountId(accs[0]?.id ?? '');
          setBaseCurrency(settings.baseCurrencyCode);
          setRatesMap(rates);
        })
        .catch((err) => {
          // Not the same as "no accounts": tell the user loading failed.
          console.error(err);
          setAccounts([]);
          setLoadError(`No pudimos cargar tus cuentas. ${getErrorMessage(err)}`);
        });
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const selectedCat = CATEGORY_PRESETS.find((c) => c.id === selectedCategory);
  const selectedAccount = accounts?.find((a) => a.id === accountId) ?? null;
  const accountCurrency = selectedAccount?.currency || 'PEN';
  const currInfo = getCurrencyInfo(accountCurrency);
  const amountNum = parseFloat(amount) || 0;
  const rate = getRateFromMap(ratesMap, accountCurrency, baseCurrency);
  const baseEquiv = amountNum * rate;
  const showEquiv = accountCurrency !== baseCurrency && amountNum > 0;

  const handleSave = async () => {
    if (!amount || !name || !selectedAccount) return;
    setSaving(true);
    setSaveError('');
    try {
      const amt = parseFloat(amount);
      const finalAmt = activeTab === 'gasto' ? -Math.abs(amt) : Math.abs(amt);
      const today = new Date();
      const hh = String(today.getHours()).padStart(2, '0');
      const min = String(today.getMinutes()).padStart(2, '0');

      await transactionsService.create({
        name,
        type: activeTab,
        amount: finalAmt,
        category: selectedCat?.label || 'Otros',
        categoryIcon: selectedCat?.icon || '📦',
        accountId: selectedAccount.id,
        account: selectedAccount.name,
        notes: note,
        date: new Date(date + 'T12:00:00').toISOString(),
        time: `${hh}:${min}`,
        ...buildCurrencyFields({
          amount: finalAmt,
          currency: accountCurrency,
          baseCurrency,
          rateToBase: rate,
          date,
        }),
      });

      notifyDataChanged();
      onSaved?.();
      onClose();
      setAmount('');
      setName('');
      setNote('');
    } catch (err) {
      // Keep the modal open with the user's data so they can retry.
      console.error(err);
      setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const isGasto = activeTab === 'gasto';
  const categories = CATEGORY_PRESETS.filter((c) =>
    isGasto ? c.id !== 'ingreso' : c.id === 'ingreso' || c.id === 'otros'
  ).map((c) => ({ label: c.label, icon: c.icon }));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in lg:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto w-full max-w-md animate-slide-up rounded-t-[28px] border-[3px] border-black bg-[#FFF9EC] shadow-[6px_6px_0px_rgba(0,0,0,1)] lg:rounded-[28px]">
        <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-gray-300 lg:hidden" />
        <div className="sheet-max space-y-5 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-1 gap-2" role="tablist" aria-label="Tipo de movimiento">
              {(['gasto', 'ingreso', 'transferencia'] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`h-11 flex-1 rounded-2xl border-[3px] px-1 text-[13px] font-black transition-all ${activeTab === tab ? 'border-black bg-[#FFD83D] text-black shadow-[0_3px_0_#111]' : 'border-gray-200 bg-white text-gray-600'}`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-[3px] border-black bg-white text-black"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="h-5 w-5"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {activeTab === 'transferencia' ? (
            <TransferForm
              saveLabel="Guardar"
              onSaved={() => {
                notifyDataChanged();
                onSaved?.();
                onClose();
              }}
            />
          ) : (
            <>
              <FormHero
                title={isGasto ? 'Nuevo gasto' : 'Nuevo ingreso'}
                subtitle={
                  isGasto
                    ? 'Registra un gasto y mantén el control de tu dinero.'
                    : 'Anota lo que recibes y mira crecer tu dinero.'
                }
                emoji={isGasto ? '🧾' : '💰'}
                tone={isGasto ? '#FFD83D' : '#C9F2DA'}
              />
              <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
              <TextField
                label={isGasto ? 'Nombre del gasto' : 'Nombre del ingreso'}
                value={name}
                onChange={setName}
                placeholder={isGasto ? 'Ej. Almuerzo' : 'Ej. Sueldo'}
                icon={selectedCat?.icon}
              />
              <div className="grid grid-cols-2 gap-3">
                <AmountField
                  label={`Monto (${currInfo.symbol})`}
                  value={amount}
                  onChange={setAmount}
                  currency={currInfo.symbol}
                />
                <DateField label="Fecha" value={date} onChange={setDate} />
              </div>

              {showEquiv && (
                <div className="rounded-2xl border-2 border-[#111] bg-[#E0EDFF] px-4 py-2.5 text-center">
                  <p className="text-xs font-bold text-[#111]">
                    Equivalente en {getCurrencyInfo(baseCurrency).name}
                  </p>
                  <p className="text-base font-black text-[#111]">
                    ≈ {formatCurrency(baseEquiv, baseCurrency)}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-gray-700">
                    1 {accountCurrency} = {formatCurrency(rate, baseCurrency)}
                  </p>
                </div>
              )}

              <CategoryChips
                categories={categories}
                value={selectedCat?.label ?? ''}
                onChange={(label) => {
                  const c = CATEGORY_PRESETS.find((x) => x.label === label);
                  if (c) setSelectedCategory(c.id);
                }}
                initial={8}
              />
              <NotesField value={note} onChange={setNote} />

              {(loadError || saveError) && (
                <p
                  role="alert"
                  className="rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]"
                >
                  {loadError || saveError}
                </p>
              )}

              <SubmitButton
                onClick={handleSave}
                disabled={!amount || !name || !selectedAccount || saving}
              >
                {saving ? 'Guardando…' : isGasto ? 'Registrar gasto' : 'Registrar ingreso'}
              </SubmitButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
