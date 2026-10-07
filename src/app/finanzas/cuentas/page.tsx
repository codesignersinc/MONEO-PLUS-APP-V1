'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import LoadError from '@/components/ui/LoadError';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';
import { accountsService, Account } from '@/lib/supabaseFinance';
import { userSettingsService, exchangeRatesService } from '@/lib/supabaseCurrency';
import {
  getCurrencyInfo,
  CURRENCIES,
  formatCurrency,
  getRateFromMap,
  groupAccountsByCurrency,
} from '@/lib/currency';
import { Plus, X, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { PERU_INSTITUTIONS, type Institution } from '@/lib/brands';
import BrandLogo from '@/components/finance/BrandLogo';
import { useDataChanged } from '@/lib/dataSync';

const ACCOUNT_TYPES = [
  { value: 'banco', label: 'Cuenta bancaria', icon: '🏦' },
  { value: 'efectivo', label: 'Efectivo', icon: '💵' },
  { value: 'digital', label: 'Billetera digital', icon: '📱' },
  { value: 'credito', label: 'Tarjeta de crédito', icon: '💳' },
  { value: 'inversion', label: 'Cuenta de inversión', icon: '📈' },
];

const COLOR_OPTIONS = [
  { color: '#16A34A', bg: '#DCFCE7' },
  { color: '#2563EB', bg: '#DBEAFE' },
  { color: '#7C3AED', bg: '#EDE9FE' },
  { color: '#DC2626', bg: '#FEE2E2' },
  { color: '#D97706', bg: '#FEF3C7' },
  { color: '#0D9488', bg: '#CCFBF1' },
  { color: '#64748B', bg: '#F1F5F9' },
];

interface AccountForm {
  name: string;
  type: Account['type'];
  institution: string;
  balance: string;
  currency: string;
  icon: string;
  color: string;
  bgColor: string;
}

type FormStep = 'tipo' | 'banco' | 'cuenta' | 'moneda' | 'saldo';

export default function CuentasPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState<FormStep>('tipo');
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState('PEN');
  const [ratesMap, setRatesMap] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState<unknown>(null);
  const [formError, setFormError] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  // Account waiting for delete confirmation.
  const [deletingAcc, setDeletingAcc] = useState<Account | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const toast = useToast();
  const [form, setForm] = useState<AccountForm>({
    name: '',
    type: 'banco',
    institution: '',
    balance: '0',
    currency: 'PEN',
    icon: '🏦',
    color: '#16A34A',
    bgColor: '#DCFCE7',
  });

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      accountsService.getAll(),
      userSettingsService.get(),
      exchangeRatesService.getRatesMap(),
    ])
      .then(([accs, settings, rates]) => {
        setAccounts(accs);
        setBaseCurrency(settings.baseCurrencyCode);
        setRatesMap(rates);
      })
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, []);

  // Reload when something is added from the quick-add sheet or the global modal.
  useDataChanged(load);

  useEffect(() => {
    load();
  }, [load]);

  const positiveAccounts = accounts.filter((a) => a.balance >= 0);
  const totalInBase = positiveAccounts.reduce((s, a) => {
    const rate = getRateFromMap(ratesMap, a.currency || 'PEN', baseCurrency);
    return s + a.balance * rate;
  }, 0);

  const currencyGroups = groupAccountsByCurrency(
    accounts
      .filter((a) => a.balance > 0)
      .map((a) => ({ balance: a.balance, currency: a.currency || 'PEN' })),
    baseCurrency,
    ratesMap
  );

  const uniqueCurrencies = [...new Set(accounts.map((a) => a.currency || 'PEN'))];

  const openAdd = () => {
    setEditingAcc(null);
    setFormStep('tipo');
    setForm({
      name: '',
      type: 'banco',
      institution: '',
      balance: '0',
      currency: 'PEN',
      icon: '🏦',
      color: '#16A34A',
      bgColor: '#DCFCE7',
    });
    setFormError('');
    setShowForm(true);
  };
  // Opened from the welcome modal ("Comenzar ahora"): start the new-account form.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('nueva') !== '1') return;
    window.history.replaceState(null, '', window.location.pathname);
    openAdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (acc: Account) => {
    setEditingAcc(acc);
    setFormStep('cuenta');
    setForm({
      name: acc.name,
      type: acc.type,
      institution: acc.institution,
      balance: String(acc.balance),
      currency: acc.currency || 'PEN',
      icon: acc.icon,
      color: acc.color,
      bgColor: acc.bgColor,
    });
    setAdjustReason('');
    setFormError('');
    setShowForm(true);
  };

  const newBalance = Math.round((parseFloat(form.balance) || 0) * 100) / 100;
  const balanceChanged = !!editingAcc && newBalance !== editingAcc.balance;

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    setFormError('');
    try {
      const { name, type, institution, currency, icon, color, bgColor } = form;
      const details = { name, type, institution, currency, icon, color, bgColor };
      if (editingAcc) {
        await accountsService.update(editingAcc.id, details);
        // The balance only changes through an audited adjustment; movements move it on their own.
        const balance = balanceChanged
          ? await accountsService.adjustBalance(editingAcc.id, newBalance, adjustReason.trim())
          : editingAcc.balance;
        setAccounts((prev) =>
          prev.map((a) => (a.id === editingAcc.id ? { ...a, ...details, balance } : a))
        );
      } else {
        const created = await accountsService.create({ ...details, balance: newBalance });
        setAccounts((prev) => [...prev, created]);
      }
      setShowForm(false);
    } catch (err) {
      console.error(err);
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingAcc) return;
    setDeleteBusy(true);
    try {
      await accountsService.delete(deletingAcc.id);
      setAccounts((prev) => prev.filter((a) => a.id !== deletingAcc.id));
      setDeletingAcc(null);
    } catch (err) {
      toast.showError(err);
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleTypeChange = (type: Account['type']) => {
    const preset = ACCOUNT_TYPES.find((t) => t.value === type);
    setForm((f) => ({ ...f, type, icon: preset?.icon || '🏦' }));
    if (!editingAcc) {
      // Banks and digital wallets start from the institution list.
      if (type === 'banco' || type === 'digital') {
        setFormStep('banco');
      } else {
        setFormStep('cuenta');
      }
    }
  };

  const handleBankSelect = (bank: Institution) => {
    setForm((f) => ({
      ...f,
      institution: bank.name,
      name: f.name || bank.name,
      color: bank.color,
      bgColor: bank.bg,
    }));
    setFormStep('cuenta');
  };

  const baseCurrencyInfo = getCurrencyInfo(baseCurrency);

  // Steps for new account: tipo → banco (if banco) → cuenta → moneda → saldo
  const allSteps: FormStep[] =
    form.type === 'banco'
      ? ['tipo', 'banco', 'cuenta', 'moneda', 'saldo']
      : ['tipo', 'cuenta', 'moneda', 'saldo'];

  const currentStepIndex = allSteps.indexOf(formStep);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-[#FFD43B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-black text-black mb-5 leading-tight">Cuentas</h1>
        <LoadError what="tus cuentas" error={loadError} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-3xl font-black text-black leading-tight">Cuentas</h1>
          {uniqueCurrencies.length > 1 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {accounts.length} cuentas · {uniqueCurrencies.length} monedas
            </p>
          )}
        </div>
        <button
          onClick={openAdd}
          className="group flex items-center gap-2 px-3 py-2 bg-[#FFD43B] text-sm rounded-xl transition-all duration-200 text-black font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
        >
          <Plus
            className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90"
            strokeWidth={2.5}
          />
          Agregar
        </button>
      </div>

      {accounts.length > 0 && (
        <>
          <div className="bg-white rounded-3xl border-[3px] border-black p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] mb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">Saldo total</p>
              <span className="text-xs font-semibold text-gray-500">
                {baseCurrencyInfo.flag} {baseCurrency}
              </span>
            </div>
            <p className="text-3xl font-black text-black leading-tight">
              {formatCurrency(totalInBase, baseCurrency)}
            </p>
          </div>

          {currencyGroups.length > 1 && (
            <div className="bg-white rounded-3xl border-[3px] border-black p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Desglose por moneda
              </p>
              <div className="space-y-2">
                {currencyGroups.map((g) => {
                  const info = getCurrencyInfo(g.currencyCode);
                  return (
                    <div key={g.currencyCode} className="flex items-center gap-3">
                      <span className="text-base">{info.flag}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-black">{info.name}</span>
                          <span className="text-xs font-bold text-black">
                            {formatCurrency(g.totalOriginal, g.currencyCode)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-fin-green rounded-full"
                            style={{ width: `${g.percentage}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          {g.currencyCode !== baseCurrency && (
                            <span className="text-xs text-gray-500">
                              ≈ {formatCurrency(g.totalInBase, baseCurrency)}
                            </span>
                          )}
                          <span className="text-xs text-gray-500 ml-auto">{g.percentage}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {accounts.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl mb-4">
            🏦
          </div>
          <h2 className="text-lg font-black text-black mb-2">Sin cuentas</h2>
          <p className="text-sm text-gray-500 max-w-xs mb-6">
            Agrega tus cuentas bancarias, efectivo, billeteras digitales o tarjetas de crédito.
          </p>
          <button
            onClick={openAdd}
            className="px-5 py-3 bg-[#FFD43B] text-sm rounded-xl transition-colors text-black font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
          >
            Agregar primera cuenta
          </button>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="space-y-3">
          {accounts.map((acc) => {
            const currInfo = getCurrencyInfo(acc.currency || 'PEN');
            const rate = getRateFromMap(ratesMap, acc.currency || 'PEN', baseCurrency);
            const baseEquiv = acc.balance * rate;
            const showEquiv = acc.currency !== baseCurrency && acc.currency;
            return (
              <div
                key={acc.id}
                className="bg-white rounded-3xl border-[3px] border-black p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] transition-shadow group"
              >
                <div className="flex items-center gap-3">
                  <BrandLogo
                    kind="account"
                    name={acc.name}
                    institution={acc.institution}
                    type={acc.type}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-black">{acc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs">{currInfo.flag}</span>
                      <span className="text-xs text-gray-500 font-semibold">
                        {acc.currency || 'PEN'}
                      </span>
                      {acc.institution && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span className="text-xs text-gray-500">{acc.institution}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p
                        className={`font-black text-base ${acc.balance < 0 ? 'text-fin-red' : 'text-black'}`}
                      >
                        {acc.balance < 0 ? '-' : ''}
                        {formatCurrency(Math.abs(acc.balance), acc.currency || 'PEN')}
                      </p>
                      {showEquiv && (
                        <p className="text-xs text-gray-500">
                          ≈ {formatCurrency(Math.abs(baseEquiv), baseCurrency)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(acc)}
                        className="p-1.5 rounded-lg border-[2px] border-black bg-white hover:bg-gray-100 transition-all"
                      >
                        <Pencil
                          className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-700 transition-colors"
                          strokeWidth={1.75}
                        />
                      </button>
                      <button
                        onClick={() => setDeletingAcc(acc)}
                        className="p-1.5 rounded-lg border-[2px] border-black bg-white hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-black" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                </div>
                {showEquiv && acc.currency !== baseCurrency && (
                  <div className="mt-2 pt-2 border-t border-gray-50">
                    <p className="text-xs text-gray-500">
                      1 {acc.currency} = {formatCurrency(rate, baseCurrency)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowForm(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] flex flex-col sheet-max"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b-[3px] border-black">
              <h2 className="font-semibold text-gray-900">
                {editingAcc ? 'Editar cuenta' : 'Nueva cuenta'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 flex items-center justify-center transition-all hover:rotate-90 duration-200 rounded-xl text-black hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step indicator for new account */}
            {!editingAcc && (
              <div className="flex items-center gap-1 px-5 py-3 border-b border-gray-50">
                {allSteps.map((step, i) => (
                  <React.Fragment key={step}>
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${formStep === step ? 'bg-black text-white' : i < currentStepIndex ? 'bg-fin-green text-white' : 'bg-gray-100 text-gray-400'}`}
                    >
                      {i + 1}
                    </div>
                    {i < allSteps.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 ${i < currentStepIndex ? 'bg-fin-green' : 'bg-gray-100'}`}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}

            <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {/* Step: Tipo */}
              {(formStep === 'tipo' || editingAcc) && (
                <>
                  {!editingAcc && (
                    <p className="text-sm font-bold text-gray-700">¿Qué tipo de cuenta es?</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {ACCOUNT_TYPES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => handleTypeChange(t.value as Account['type'])}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all ${form.type === t.value ? 'border-black bg-[#FFD43B] text-black' : 'border-gray-200 bg-white text-black hover:border-gray-300'}`}
                      >
                        <span className="text-xl">{t.icon}</span>
                        <span className="text-xs">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Step: Banco selector */}
              {formStep === 'banco' && !editingAcc && (
                <>
                  <p className="text-sm font-bold text-gray-700">
                    {form.type === 'digital' ? 'Selecciona tu billetera' : 'Selecciona tu banco'}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {PERU_INSTITUTIONS.filter((b) => !!b.wallet === (form.type === 'digital')).map(
                      (bank) => (
                        <button
                          key={bank.id}
                          onClick={() => handleBankSelect(bank)}
                          className="flex flex-col items-center gap-1.5 group"
                        >
                          {/* Retro black-bordered card */}
                          <div
                            className="w-full aspect-square rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] bg-white flex items-center justify-center overflow-hidden transition-all duration-150 group-hover:shadow-[1px_1px_0px_0px_#000] group-hover:translate-x-[2px] group-hover:translate-y-[2px] group-active:shadow-none group-active:translate-x-[3px] group-active:translate-y-[3px]"
                            style={{ background: bank.bg }}
                          >
                            {bank.image ? (
                              <div className="relative w-full h-full p-1.5">
                                <Image
                                  src={bank.image}
                                  alt={`Logo ${bank.name}`}
                                  fill
                                  className="object-contain p-1"
                                  sizes="80px"
                                />
                              </div>
                            ) : (
                              <span
                                className="text-lg font-black tracking-tight"
                                style={{ color: bank.color }}
                              >
                                {bank.name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-semibold text-gray-700 text-center leading-tight line-clamp-2">
                            {bank.name}
                          </span>
                        </button>
                      )
                    )}
                  </div>
                  <button
                    onClick={() => setFormStep('cuenta')}
                    className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-xs font-semibold text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-all"
                  >
                    {form.type === 'digital'
                      ? 'Otra billetera / continuar sin seleccionar'
                      : 'Otro banco / continuar sin seleccionar'}
                  </button>
                </>
              )}

              {/* Step: Cuenta */}
              {(formStep === 'cuenta' || editingAcc) && (
                <>
                  {!editingAcc && (
                    <p className="text-sm font-bold text-gray-700">Datos de la cuenta</p>
                  )}
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Nombre de la cuenta (ej: BCP Ahorros)"
                    className="w-full px-4 h-14 bg-white rounded-2xl border-[3px] border-[#111] text-[16px] font-bold text-[#111] placeholder:font-semibold placeholder:text-gray-400 outline-none focus:shadow-[0_0_0_3px_#FFD83D] transition-shadow"
                  />
                  <input
                    type="text"
                    value={form.institution}
                    onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
                    placeholder="Institución (ej: BCP, Interbank, Yape)"
                    className="w-full px-4 h-14 bg-white rounded-2xl border-[3px] border-[#111] text-[16px] font-bold text-[#111] placeholder:font-semibold placeholder:text-gray-400 outline-none focus:shadow-[0_0_0_3px_#FFD83D] transition-shadow"
                  />
                  {!editingAcc && (
                    <button
                      onClick={() => {
                        if (form.name) setFormStep('moneda');
                      }}
                      disabled={!form.name}
                      className="w-full py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      Continuar <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}

              {/* Step: Moneda */}
              {(formStep === 'moneda' || editingAcc) && (
                <>
                  {!editingAcc && (
                    <p className="text-sm font-bold text-gray-700">
                      ¿En qué moneda está esta cuenta?
                    </p>
                  )}
                  {!editingAcc && (
                    <p className="text-xs text-gray-500">
                      Puedes tener cuentas en diferentes monedas. MONEO las organizará
                      automáticamente.
                    </p>
                  )}
                  <div className="space-y-2">
                    {CURRENCIES.slice(0, 4).map((c) => (
                      <button
                        key={c.code}
                        onClick={() => {
                          setForm((f) => ({ ...f, currency: c.code }));
                          if (!editingAcc) setFormStep('saldo');
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${form.currency === c.code ? 'border-black bg-[#FFD43B] text-black' : 'border-gray-200 bg-white text-black hover:border-gray-300'}`}
                      >
                        <span className="text-2xl">{c.flag}</span>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-semibold text-black">{c.name}</p>
                          <p className="text-xs text-gray-500">
                            {c.code} · {c.symbol}
                          </p>
                        </div>
                        {form.currency === c.code && (
                          <div className="w-4 h-4 rounded-full bg-black" />
                        )}
                      </button>
                    ))}
                  </div>
                  {editingAcc && (
                    <div className="pt-2">
                      <p className="text-xs text-gray-500 mb-2">Más monedas</p>
                      <select
                        value={form.currency}
                        onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                        className="w-full px-4 h-14 bg-white rounded-2xl border-[3px] border-[#111] text-[16px] font-bold text-[#111] placeholder:font-semibold placeholder:text-gray-400 outline-none focus:shadow-[0_0_0_3px_#FFD83D] transition-shadow"
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.name} ({c.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* Step: Saldo */}
              {(formStep === 'saldo' || editingAcc) && (
                <>
                  {!editingAcc && (
                    <p className="text-sm font-bold text-gray-700">¿Cuál es el saldo actual?</p>
                  )}
                  <div className="flex items-center gap-2 px-4 min-h-[56px] bg-white rounded-2xl border-[3px] border-[#111] focus-within:shadow-[0_0_0_3px_#FFD83D]">
                    <span className="text-gray-500 font-semibold text-sm">
                      {getCurrencyInfo(form.currency).symbol}
                    </span>
                    <input
                      type="number"
                      value={form.balance}
                      onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
                      placeholder="0.00"
                      className="flex-1 min-w-0 bg-transparent text-[16px] font-bold text-[#111] outline-none"
                    />
                    <span className="text-xs text-gray-500 font-semibold">{form.currency}</span>
                  </div>
                  {balanceChanged && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">
                        Los movimientos actualizan el saldo solos. Este cambio se registrará como
                        ajuste manual.
                      </p>
                      <input
                        type="text"
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                        placeholder="Motivo del ajuste (opcional)"
                        maxLength={200}
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-[2px] border-gray-200 text-sm text-black outline-none"
                      />
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Color</p>
                    <div className="flex gap-2">
                      {COLOR_OPTIONS.map((opt) => (
                        <button
                          key={opt.color}
                          onClick={() =>
                            setForm((f) => ({ ...f, color: opt.color, bgColor: opt.bg }))
                          }
                          className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === opt.color ? 'border-fin-text scale-110' : 'border-transparent'}`}
                          style={{ background: opt.color }}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Save button */}
              {formError && (
                <p role="alert" className="text-sm font-semibold text-red-600">
                  {formError}
                </p>
              )}
              {(formStep === 'saldo' || editingAcc) && (
                <button
                  onClick={handleSave}
                  disabled={!form.name || saving}
                  className="w-full py-3.5 bg-[#FFD43B] rounded-xl transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed text-black font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
                >
                  {saving ? 'Guardando...' : editingAcc ? 'Guardar cambios' : 'Agregar cuenta'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {deletingAcc && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !deleteBusy && setDeletingAcc(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="relative bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] p-5 space-y-4"
          >
            <h2 id="delete-account-title" className="font-semibold text-black">
              ¿Eliminar la cuenta «{deletingAcc.name}»?
            </h2>
            <p className="text-sm text-gray-600">
              Sus movimientos, transferencias y conversiones se conservan en tu historial, pero
              quedarán sin cuenta. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingAcc(null)}
                disabled={deleteBusy}
                className="flex-1 py-3 rounded-xl border-[2px] border-black text-sm font-semibold text-gray-700 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteBusy}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:bg-red-700 disabled:opacity-50"
              >
                {deleteBusy ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
