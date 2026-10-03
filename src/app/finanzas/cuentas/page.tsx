'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { accountsService, Account } from '@/lib/supabaseFinance';
import { userSettingsService, exchangeRatesService } from '@/lib/supabaseCurrency';
import { getCurrencyInfo, CURRENCIES, formatCurrency, getRateFromMap, groupAccountsByCurrency } from '@/lib/currency';
import { Plus, X, Pencil, Trash2, ChevronRight } from 'lucide-react';

const ACCOUNT_TYPES = [
  { value: 'banco', label: 'Cuenta bancaria', icon: '🏦' },
  { value: 'efectivo', label: 'Efectivo', icon: '💵' },
  { value: 'digital', label: 'Billetera digital', icon: '📱' },
  { value: 'credito', label: 'Tarjeta de crédito', icon: '💳' },
  { value: 'inversion', label: 'Cuenta de inversión', icon: '📈' },
];

const PERUVIAN_BANKS = [
  { id: 'bcp', name: 'BCP', image: '/assets/images/bcp-1790986661188.jpg', color: '#003087', bg: '#E8F0FF' },
  { id: 'interbank', name: 'Interbank', image: '/assets/images/interbank-1790986660881.png', color: '#00A651', bg: '#E6F7EE' },
  { id: 'bbva', name: 'BBVA', image: '/assets/images/bbva-1790986661190.png', color: '#004481', bg: '#E6EEF7' },
  { id: 'scotiabank', name: 'Scotiabank', image: '/assets/images/scotiabank-1790986661195.png', color: '#CC0000', bg: '#FFE6E6' },
  { id: 'banbif', name: 'BanBif', image: '/assets/images/banbif-1790986684660.jpg', color: '#E30613', bg: '#FFE6E7' },
  { id: 'nacion', name: 'Banco de la Nación', image: '/assets/images/banco_de_la_nacion-1790987077025.jpg', color: '#C8102E', bg: '#FFE6EA' },
  { id: 'ripley', name: 'Banco Ripley', image: '/assets/images/bancoripley-1790987077028.jpg', color: '#6B21A8', bg: '#F3E8FF' },
  { id: 'falabella', name: 'Banco Falabella', image: '/assets/images/falabella-1790987077026.png', color: '#1D4ED8', bg: '#DBEAFE' },
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
  const [form, setForm] = useState<AccountForm>({
    name: '', type: 'banco', institution: '', balance: '0',
    currency: 'PEN', icon: '🏦', color: '#16A34A', bgColor: '#DCFCE7',
  });

  useEffect(() => {
    Promise.all([
      accountsService.getAll(),
      userSettingsService.get(),
      exchangeRatesService.getRatesMap(),
    ]).then(([accs, settings, rates]) => {
      setAccounts(accs);
      setBaseCurrency(settings.baseCurrencyCode);
      setRatesMap(rates);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const positiveAccounts = accounts.filter(a => a.balance >= 0);
  const totalInBase = positiveAccounts.reduce((s, a) => {
    const rate = getRateFromMap(ratesMap, a.currency || 'PEN', baseCurrency);
    return s + a.balance * rate;
  }, 0);

  const currencyGroups = groupAccountsByCurrency(
    accounts.filter(a => a.balance > 0).map(a => ({ balance: a.balance, currency: a.currency || 'PEN' })),
    baseCurrency,
    ratesMap
  );

  const uniqueCurrencies = [...new Set(accounts.map(a => a.currency || 'PEN'))];

  const openAdd = () => {
    setEditingAcc(null);
    setFormStep('tipo');
    setForm({ name: '', type: 'banco', institution: '', balance: '0', currency: 'PEN', icon: '🏦', color: '#16A34A', bgColor: '#DCFCE7' });
    setShowForm(true);
  };

  const openEdit = (acc: Account) => {
    setEditingAcc(acc);
    setFormStep('cuenta');
    setForm({ name: acc.name, type: acc.type, institution: acc.institution, balance: String(acc.balance), currency: acc.currency || 'PEN', icon: acc.icon, color: acc.color, bgColor: acc.bgColor });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const accountData = { ...form, balance: parseFloat(form.balance) || 0 };
      if (editingAcc) {
        await accountsService.update(editingAcc.id, accountData);
        setAccounts(prev => prev.map(a => a.id === editingAcc.id ? { ...a, ...accountData } : a));
      } else {
        const created = await accountsService.create(accountData);
        if (created) setAccounts(prev => [...prev, created]);
      }
      setShowForm(false);
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await accountsService.delete(id);
      setAccounts(prev => prev.filter(a => a.id !== id));
    } catch (err) { console.error(err); }
  };

  const handleTypeChange = (type: Account['type']) => {
    const preset = ACCOUNT_TYPES.find(t => t.value === type);
    setForm(f => ({ ...f, type, icon: preset?.icon || '🏦' }));
    if (!editingAcc) {
      if (type === 'banco') {
        setFormStep('banco');
      } else {
        setFormStep('cuenta');
      }
    }
  };

  const handleBankSelect = (bank: typeof PERUVIAN_BANKS[0]) => {
    setForm(f => ({
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
  const allSteps: FormStep[] = form.type === 'banco'
    ? ['tipo', 'banco', 'cuenta', 'moneda', 'saldo']
    : ['tipo', 'cuenta', 'moneda', 'saldo'];

  const currentStepIndex = allSteps.indexOf(formStep);

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-manrope font-800 text-fin-text">Cuentas</h1>
          {uniqueCurrencies.length > 1 && (
            <p className="text-xs text-fin-muted mt-0.5">{accounts.length} cuentas · {uniqueCurrencies.length} monedas</p>
          )}
        </div>
        <button
          onClick={openAdd}
          className="group flex items-center gap-2 px-3 py-2 bg-fin-green text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-all duration-200"
        >
          <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
          Agregar
        </button>
      </div>

      {accounts.length > 0 && (
        <>
          <div className="bg-white rounded-2xl border border-fin-border p-4 shadow-fin-card mb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-fin-muted">Saldo total</p>
              <span className="text-xs font-semibold text-fin-muted">{baseCurrencyInfo.flag} {baseCurrency}</span>
            </div>
            <p className="text-2xl font-manrope font-800 text-fin-text">{formatCurrency(totalInBase, baseCurrency)}</p>
          </div>

          {currencyGroups.length > 1 && (
            <div className="bg-white rounded-2xl border border-fin-border p-4 shadow-fin-card mb-4">
              <p className="text-xs font-semibold text-fin-muted uppercase tracking-wide mb-3">Desglose por moneda</p>
              <div className="space-y-2">
                {currencyGroups.map(g => {
                  const info = getCurrencyInfo(g.currencyCode);
                  return (
                    <div key={g.currencyCode} className="flex items-center gap-3">
                      <span className="text-base">{info.flag}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-fin-text">{info.name}</span>
                          <span className="text-xs font-bold text-fin-text">{formatCurrency(g.totalOriginal, g.currencyCode)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-fin-green rounded-full" style={{ width: `${g.percentage}%` }} />
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          {g.currencyCode !== baseCurrency && (
                            <span className="text-xs text-fin-muted">≈ {formatCurrency(g.totalInBase, baseCurrency)}</span>
                          )}
                          <span className="text-xs text-fin-muted ml-auto">{g.percentage}%</span>
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
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl mb-4">🏦</div>
          <h2 className="text-lg font-manrope font-800 text-fin-text mb-2">Sin cuentas</h2>
          <p className="text-sm text-fin-muted max-w-xs mb-6">Agrega tus cuentas bancarias, efectivo, billeteras digitales o tarjetas de crédito.</p>
          <button onClick={openAdd} className="px-5 py-3 bg-fin-green text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors">
            Agregar primera cuenta
          </button>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="space-y-3">
          {accounts.map(acc => {
            const currInfo = getCurrencyInfo(acc.currency || 'PEN');
            const rate = getRateFromMap(ratesMap, acc.currency || 'PEN', baseCurrency);
            const baseEquiv = acc.balance * rate;
            const showEquiv = acc.currency !== baseCurrency && acc.currency;
            return (
              <div key={acc.id} className="bg-white rounded-2xl border border-fin-border p-4 shadow-fin-card hover:shadow-fin-card-hover transition-shadow group">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: acc.bgColor }}>{acc.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-manrope font-700 text-fin-text">{acc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs">{currInfo.flag}</span>
                      <span className="text-xs text-fin-muted font-semibold">{acc.currency || 'PEN'}</span>
                      {acc.institution && <><span className="w-1 h-1 rounded-full bg-gray-300" /><span className="text-xs text-fin-muted">{acc.institution}</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className={`font-manrope font-700 text-base ${acc.balance < 0 ? 'text-fin-red' : 'text-fin-text'}`}>
                        {acc.balance < 0 ? '-' : ''}{formatCurrency(Math.abs(acc.balance), acc.currency || 'PEN')}
                      </p>
                      {showEquiv && (
                        <p className="text-xs text-fin-muted">≈ {formatCurrency(Math.abs(baseEquiv), baseCurrency)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(acc)} className="group p-1.5 rounded-lg hover:bg-gray-100 transition-all duration-150">
                        <Pencil className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-700 transition-colors" strokeWidth={1.75} />
                      </button>
                      <button onClick={() => handleDelete(acc.id)} className="group p-1.5 rounded-lg hover:bg-red-50 transition-all duration-150">
                        <Trash2 className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-500 transition-colors" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                </div>
                {showEquiv && acc.currency !== baseCurrency && (
                  <div className="mt-2 pt-2 border-t border-gray-50">
                    <p className="text-xs text-fin-muted">1 {acc.currency} = {formatCurrency(rate, baseCurrency)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editingAcc ? 'Editar cuenta' : 'Nueva cuenta'}</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all hover:rotate-90 duration-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step indicator for new account */}
            {!editingAcc && (
              <div className="flex items-center gap-1 px-5 py-3 border-b border-gray-50">
                {allSteps.map((step, i) => (
                  <React.Fragment key={step}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${formStep === step ? 'bg-black text-white' : i < currentStepIndex ? 'bg-fin-green text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {i + 1}
                    </div>
                    {i < allSteps.length - 1 && <div className={`flex-1 h-0.5 ${i < currentStepIndex ? 'bg-fin-green' : 'bg-gray-100'}`} />}
                  </React.Fragment>
                ))}
              </div>
            )}

            <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {/* Step: Tipo */}
              {(formStep === 'tipo' || editingAcc) && (
                <>
                  {!editingAcc && <p className="text-sm font-bold text-gray-700">¿Qué tipo de cuenta es?</p>}
                  <div className="grid grid-cols-2 gap-2">
                    {ACCOUNT_TYPES.map(t => (
                      <button key={t.value} onClick={() => handleTypeChange(t.value as Account['type'])}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all ${form.type === t.value ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
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
                  <p className="text-sm font-bold text-gray-700">Selecciona tu banco</p>
                  <div className="grid grid-cols-4 gap-2">
                    {PERUVIAN_BANKS.map(bank => (
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
                              {bank.initial}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-semibold text-gray-700 text-center leading-tight line-clamp-2">
                          {bank.name}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setFormStep('cuenta')}
                    className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-xs font-semibold text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-all"
                  >
                    Otro banco / continuar sin seleccionar
                  </button>
                </>
              )}

              {/* Step: Cuenta */}
              {(formStep === 'cuenta' || editingAcc) && (
                <>
                  {!editingAcc && <p className="text-sm font-bold text-gray-700">Datos de la cuenta</p>}
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nombre de la cuenta (ej: BCP Ahorros)"
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-fin-text placeholder-gray-400 outline-none focus:border-fin-green transition-colors" />
                  <input type="text" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
                    placeholder="Institución (ej: BCP, Interbank, Yape)"
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-fin-text placeholder-gray-400 outline-none focus:border-fin-green transition-colors" />
                  {!editingAcc && (
                    <button onClick={() => { if (form.name) setFormStep('moneda'); }}
                      disabled={!form.name}
                      className="w-full py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                      Continuar <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}

              {/* Step: Moneda */}
              {(formStep === 'moneda' || editingAcc) && (
                <>
                  {!editingAcc && <p className="text-sm font-bold text-gray-700">¿En qué moneda está esta cuenta?</p>}
                  {!editingAcc && <p className="text-xs text-fin-muted">Puedes tener cuentas en diferentes monedas. MONEO las organizará automáticamente.</p>}
                  <div className="space-y-2">
                    {CURRENCIES.slice(0, 4).map(c => (
                      <button key={c.code} onClick={() => { setForm(f => ({ ...f, currency: c.code })); if (!editingAcc) setFormStep('saldo'); }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${form.currency === c.code ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <span className="text-2xl">{c.flag}</span>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-semibold text-fin-text">{c.name}</p>
                          <p className="text-xs text-fin-muted">{c.code} · {c.symbol}</p>
                        </div>
                        {form.currency === c.code && <div className="w-4 h-4 rounded-full bg-black" />}
                      </button>
                    ))}
                  </div>
                  {editingAcc && (
                    <div className="pt-2">
                      <p className="text-xs text-fin-muted mb-2">Más monedas</p>
                      <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-fin-text outline-none focus:border-fin-green transition-colors">
                        {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.code})</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* Step: Saldo */}
              {(formStep === 'saldo' || editingAcc) && (
                <>
                  {!editingAcc && <p className="text-sm font-bold text-gray-700">¿Cuál es el saldo actual?</p>}
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl border border-fin-border">
                    <span className="text-fin-muted font-semibold text-sm">{getCurrencyInfo(form.currency).symbol}</span>
                    <input type="number" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))}
                      placeholder="0.00" className="flex-1 bg-transparent text-sm font-semibold text-fin-text outline-none" />
                    <span className="text-xs text-fin-muted font-semibold">{form.currency}</span>
                  </div>
                  <div>
                    <p className="text-xs text-fin-muted mb-2">Color</p>
                    <div className="flex gap-2">
                      {COLOR_OPTIONS.map(opt => (
                        <button key={opt.color} onClick={() => setForm(f => ({ ...f, color: opt.color, bgColor: opt.bg }))}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === opt.color ? 'border-fin-text scale-110' : 'border-transparent'}`}
                          style={{ background: opt.color }} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Save button */}
              {(formStep === 'saldo' || editingAcc) && (
                <button onClick={handleSave} disabled={!form.name || saving}
                  className="w-full py-3.5 bg-fin-green text-white font-manrope font-700 rounded-xl hover:bg-green-700 transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? 'Guardando...' : editingAcc ? 'Guardar cambios' : 'Agregar cuenta'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
