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
import { CATEGORY_PRESETS } from '@/lib/financeStore';
import { getErrorMessage } from '@/lib/dataError';
import TransferForm from '@/components/finance/TransferForm';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

type TabType = 'gasto' | 'ingreso' | 'transferencia';

interface AccountOption {
  id: string;
  name: string;
  icon: string;
  currency: string;
  balance: number;
}

export default function AddTransactionModal({
  isOpen,
  onClose,
  onSaved,
}: AddTransactionModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('gasto');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORY_PRESETS[0].id);
  const [selectedAccount, setSelectedAccount] = useState<AccountOption | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState('PEN');
  const [ratesMap, setRatesMap] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoadError('');
      setSaveError('');
      setSelectedAccount(null);
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
          const opts: AccountOption[] = accs.map((a) => ({
            id: a.id,
            name: a.name,
            icon: a.icon,
            currency: a.currency || 'PEN',
            balance: a.balance,
          }));
          setAccounts(opts);
          setBaseCurrency(settings.baseCurrencyCode);
          setRatesMap(rates);
        })
        .catch((err) => {
          // Not the same as "no accounts": tell the user loading failed.
          console.error(err);
          setLoadError(`No pudimos cargar tus cuentas. ${getErrorMessage(err)}`);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedCat = CATEGORY_PRESETS.find((c) => c.id === selectedCategory);
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

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-t-3xl lg:rounded-2xl border-[3px] border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] animate-slide-up mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black">
          <h2 className="font-black text-black text-lg">Agregar movimiento</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-black transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-5 h-5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Tabs */}
          <div className="flex gap-2">
            {(['gasto', 'ingreso', 'transferencia'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-xl border-[2px] text-sm font-black capitalize transition-all ${activeTab === tab ? 'bg-[#FFD43B] border-black text-black' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === 'transferencia' ? (
            <TransferForm
              saveLabel="Guardar"
              onSaved={() => {
                onSaved?.();
                onClose();
              }}
            />
          ) : (
            <>
              {/* Amount with currency */}
              <div className="flex items-center justify-center gap-2 py-2">
                <span className="text-3xl font-black text-black">{currInfo.symbol}</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="text-4xl font-black text-black bg-transparent border-none outline-none w-40 text-center placeholder-gray-300"
                />
                <span className="text-sm font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                  {accountCurrency}
                </span>
              </div>

              {/* Equivalent in base currency */}
              {showEquiv && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-center">
                  <p className="text-xs text-blue-600 font-semibold">
                    Equivalente en {getCurrencyInfo(baseCurrency).name}
                  </p>
                  <p className="text-base font-bold text-blue-800">
                    ≈ {formatCurrency(baseEquiv, baseCurrency)}
                  </p>
                  <p className="text-xs text-blue-500 mt-0.5">
                    1 {accountCurrency} = {formatCurrency(rate, baseCurrency)}
                  </p>
                </div>
              )}

              {/* Name */}
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Descripción (ej: Almuerzo, Sueldo...)"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border-[2px] border-gray-200 text-sm text-black placeholder-gray-400 outline-none focus:border-black transition-colors"
              />

              {/* Category */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowCategoryPicker(!showCategoryPicker);
                    setShowAccountPicker(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border-[2px] border-gray-200 hover:border-black transition-colors"
                >
                  <span className="text-xl">{selectedCat?.icon}</span>
                  <span className="flex-1 text-left text-sm font-medium text-black">
                    {selectedCat?.label}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-4 h-4 text-black"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {showCategoryPicker && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-black rounded-xl shadow-lg z-10 p-2 grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                    {CATEGORY_PRESETS.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          setShowCategoryPicker(false);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${selectedCategory === cat.id ? 'bg-[#FFD43B] text-black font-bold' : 'hover:bg-gray-50 text-black'}`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Account */}
              {accounts.length > 0 ? (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowAccountPicker(!showAccountPicker);
                      setShowCategoryPicker(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border-[2px] border-gray-200 hover:border-black transition-colors"
                  >
                    <span className="text-xl">{selectedAccount?.icon || '🏦'}</span>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-black">
                        {selectedAccount?.name || 'Seleccionar cuenta'}
                      </p>
                      {selectedAccount && (
                        <p className="text-xs text-gray-500">
                          {getCurrencyInfo(selectedAccount.currency).flag}{' '}
                          {selectedAccount.currency} ·{' '}
                          {formatCurrency(selectedAccount.balance, selectedAccount.currency)}
                        </p>
                      )}
                    </div>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-4 h-4 text-black"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {showAccountPicker && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-black rounded-xl shadow-lg z-10 p-2 space-y-1 max-h-48 overflow-y-auto">
                      {accounts.map((acc) => {
                        const ci = getCurrencyInfo(acc.currency);
                        return (
                          <button
                            key={acc.id}
                            onClick={() => {
                              setSelectedAccount(acc);
                              setShowAccountPicker(false);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${selectedAccount?.id === acc.id ? 'bg-[#FFD43B] text-black font-bold' : 'hover:bg-gray-50 text-black'}`}
                          >
                            <span>{acc.icon}</span>
                            <div className="flex-1 text-left">
                              <p className="font-medium">{acc.name}</p>
                              <p className="text-xs text-gray-500">
                                {ci.flag} {acc.currency}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-4 py-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-700">
                  Primero agrega una cuenta en la sección Cuentas
                </div>
              )}

              {/* Date */}
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border-[2px] border-gray-200 text-sm text-black outline-none focus:border-black transition-colors"
              />

              {/* Note */}
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nota (opcional)"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border-[2px] border-gray-200 text-sm text-black placeholder-gray-400 outline-none focus:border-black transition-colors"
              />

              {loadError && (
                <p role="alert" className="text-sm font-semibold text-red-600">
                  {loadError}
                </p>
              )}
              {saveError && (
                <p role="alert" className="text-sm font-semibold text-red-600">
                  {saveError}
                </p>
              )}

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={!amount || !name || !selectedAccount || saving}
                className="w-full py-3.5 bg-[#FFD43B] rounded-xl active:scale-98 transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed text-black font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
