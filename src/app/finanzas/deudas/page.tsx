'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { debtsService, Debt } from '@/lib/supabaseFinance';
import { Plus, X, Pencil, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import BrandLogo from '@/components/finance/BrandLogo';
import { AccountPickerModal } from '@/components/finance/AccountAmountPicker';
import LoadError from '@/components/ui/LoadError';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';

const DEBT_TYPES = [
  'Tarjeta de crédito',
  'Préstamo personal',
  'Préstamo hipotecario',
  'Préstamo vehicular',
  'Otro',
];

export default function DeudasPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [formError, setFormError] = useState('');
  // Debt being paid and the amount chosen in the pay modal.
  const [paying, setPaying] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    institution: '',
    icon: '💳',
    balance: '',
    limit: '',
    monthlyPayment: '',
    dueDate: '',
    type: 'Tarjeta de crédito',
    color: '#DC2626',
    interestRate: '',
  });

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    debtsService
      .getAll()
      .then(setDebts)
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const nextPayment = debts
    .filter((d) => d.balance > 0 && d.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  const openAdd = () => {
    setEditingDebt(null);
    setForm({
      name: '',
      institution: '',
      icon: '💳',
      balance: '',
      limit: '',
      monthlyPayment: '',
      dueDate: '',
      type: 'Tarjeta de crédito',
      color: '#DC2626',
      interestRate: '',
    });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (debt: Debt) => {
    setEditingDebt(debt);
    setForm({
      name: debt.name,
      institution: debt.institution,
      icon: debt.icon,
      balance: String(debt.balance),
      limit: String(debt.limit),
      monthlyPayment: String(debt.monthlyPayment),
      dueDate: debt.dueDate,
      type: debt.type,
      color: debt.color,
      interestRate: String(debt.interestRate),
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    setFormError('');
    try {
      const debtData: Omit<Debt, 'id'> = {
        name: form.name,
        institution: form.institution,
        icon: form.type === 'Tarjeta de crédito' ? '💳' : '🏦',
        balance: parseFloat(form.balance) || 0,
        limit: parseFloat(form.limit) || 0,
        monthlyPayment: parseFloat(form.monthlyPayment) || 0,
        dueDate: form.dueDate,
        type: form.type,
        color: '#DC2626',
        interestRate: parseFloat(form.interestRate) || 0,
      };
      if (editingDebt) {
        await debtsService.update(editingDebt.id, debtData);
        setDebts((prev) => prev.map((d) => (d.id === editingDebt.id ? { ...d, ...debtData } : d)));
      } else {
        const created = await debtsService.create(debtData);
        setDebts((prev) => [...prev, created]);
      }
      setShowForm(false);
    } catch (err) {
      console.error(err);
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openPay = (debt: Debt) => {
    setPaying(debt);
    setPayAmount(String(Math.min(debt.monthlyPayment || debt.balance, debt.balance)));
  };

  const payAmountNum = Math.round((parseFloat(payAmount) || 0) * 100) / 100;

  // The database records the expense in the chosen account and lowers the debt.
  const confirmPay = async (accountId: string, accountAmount?: number) => {
    if (!paying) return;
    const newBalance = await debtsService.pay(paying.id, accountId, payAmountNum, accountAmount);
    setDebts((prev) => prev.map((d) => (d.id === paying.id ? { ...d, balance: newBalance } : d)));
    toast.showSuccess(
      newBalance <= 0
        ? `¡${paying.name} quedó pagada!`
        : `Pago registrado. Saldo de ${paying.name}: S/ ${newBalance.toFixed(2)}`
    );
    setPaying(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await debtsService.delete(id);
      setDebts((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      toast.showError(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-fin-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-black text-black mb-5 leading-tight">Deudas</h1>
        <LoadError what="tus deudas" error={loadError} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-3xl font-black text-black leading-tight">Deudas</h1>
        <button
          onClick={openAdd}
          className="group flex items-center gap-2 px-3 py-2 text-sm rounded-xl transition-all duration-200 bg-[#FFD43B] text-black font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
        >
          <Plus
            className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90"
            strokeWidth={2.5}
          />
          Agregar deuda
        </button>
      </div>

      {debts.length > 0 && (
        <div className="bg-white rounded-3xl border-[3px] border-black p-5 mb-5 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-500" strokeWidth={1.75} />
            <p className="text-sm text-gray-500">Total deudas</p>
          </div>
          <p className="text-3xl font-black text-fin-red">S/ {totalDebt.toFixed(2)}</p>
          {nextPayment && (
            <p className="text-sm text-gray-500 mt-1">
              Próximo pago:{' '}
              <span className="font-semibold text-black">
                {nextPayment.dueDate} · S/ {nextPayment.monthlyPayment.toFixed(2)}
              </span>
            </p>
          )}
        </div>
      )}

      {debts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-3xl mb-4">
            💳
          </div>
          <h2 className="text-lg font-black text-black mb-2">Sin deudas registradas</h2>
          <p className="text-sm text-gray-500 max-w-xs mb-6">
            Registra tus tarjetas de crédito y préstamos para hacer seguimiento de tus pagos.
          </p>
          <button
            onClick={openAdd}
            className="px-5 py-3 text-sm rounded-xl transition-all bg-[#FFD43B] text-black font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
          >
            Agregar primera deuda
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {debts.map((debt) => {
            const usedPct = debt.limit > 0 ? Math.round((debt.balance / debt.limit) * 100) : 0;
            return (
              <div
                key={debt.id}
                className="bg-white rounded-3xl border-[3px] border-black p-5 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] transition-shadow group"
              >
                <div className="flex items-start gap-3 mb-4">
                  <BrandLogo
                    kind="debt"
                    name={debt.name}
                    institution={debt.institution}
                    type={debt.type}
                  />
                  <div className="flex-1">
                    <p className="font-black text-black">{debt.name}</p>
                    <p className="text-xs text-gray-500">
                      {debt.institution} · {debt.type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="font-black text-fin-red">S/ {debt.balance.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">saldo</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(debt)}
                        className="p-1.5 rounded-lg border-[2px] border-black bg-white hover:bg-gray-100 transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5 text-black" strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={() => handleDelete(debt.id)}
                        className="p-1.5 rounded-lg border-[2px] border-black bg-white hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-black" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4 py-3 border-y border-gray-50">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Límite</p>
                    <p className="text-sm font-semibold text-black">
                      S/ {debt.limit.toLocaleString('es-PE')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Pago mensual</p>
                    <p className="text-sm font-semibold text-black">
                      S/ {debt.monthlyPayment.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Vencimiento</p>
                    <p className="text-sm font-semibold text-black">{debt.dueDate || '—'}</p>
                  </div>
                </div>
                {(() => {
                  const original = Math.max(debt.originalAmount ?? debt.balance, debt.balance);
                  const paid = Math.max(original - debt.balance, 0);
                  const pct = original > 0 ? Math.round((paid / original) * 100) : 0;
                  const settled = debt.balance <= 0;
                  return (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-bold text-gray-600">
                          Pagado S/ {paid.toFixed(2)} de S/ {original.toFixed(2)}
                        </span>
                        <span className="font-black text-black">{pct}%</span>
                      </div>
                      <div
                        className="h-3 bg-gray-100 border-[2px] border-black rounded-full overflow-hidden"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Avance de pago de ${debt.name}`}
                      >
                        <div
                          className="h-full bg-[#4ADE80] rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      {settled ? (
                        <p className="mt-3 flex items-center justify-center gap-2 rounded-xl border-[2px] border-black bg-[#DCFCE7] py-2 text-sm font-black text-green-800">
                          <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} /> Deuda pagada
                        </p>
                      ) : (
                        <button
                          onClick={() => openPay(debt)}
                          className="mt-3 w-full py-2.5 rounded-xl text-sm transition-all bg-[#FFD43B] text-black font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
                        >
                          Registrar pago
                        </button>
                      )}
                    </div>
                  );
                })()}
                {debt.limit > 0 && (
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-500">Uso del crédito</span>
                      <span
                        className="font-semibold"
                        style={{ color: usedPct > 70 ? '#DC2626' : '#16A34A' }}
                      >
                        {usedPct}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(usedPct, 100)}%`,
                          background: usedPct > 70 ? '#DC2626' : '#16A34A',
                        }}
                      />
                    </div>
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
            className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b-[3px] border-black">
              <h2 className="font-semibold text-gray-900">
                {editingDebt ? 'Editar deuda' : 'Nueva deuda'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 flex items-center justify-center transition-all hover:rotate-90 duration-200 rounded-xl text-black hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 max-h-[80vh] overflow-y-auto">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nombre (ej: Tarjeta BCP Visa)"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border-[2px] border-gray-200 text-sm text-black placeholder-gray-400 outline-none focus:border-black transition-colors"
              />
              <input
                type="text"
                value={form.institution}
                onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
                placeholder="Institución (ej: BCP, Interbank)"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border-[2px] border-gray-200 text-sm text-black placeholder-gray-400 outline-none focus:border-black transition-colors"
              />
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border-[2px] border-gray-200 text-sm text-black outline-none focus:border-black transition-colors"
              >
                {DEBT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 px-3 py-3 bg-gray-50 rounded-xl border-[2px] border-gray-200 focus-within:border-black">
                  <span className="text-gray-500 text-xs">Saldo S/</span>
                  <input
                    type="number"
                    value={form.balance}
                    onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
                    placeholder="0"
                    className="flex-1 bg-transparent text-sm font-semibold text-black outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 px-3 py-3 bg-gray-50 rounded-xl border-[2px] border-gray-200 focus-within:border-black">
                  <span className="text-gray-500 text-xs">Límite S/</span>
                  <input
                    type="number"
                    value={form.limit}
                    onChange={(e) => setForm((f) => ({ ...f, limit: e.target.value }))}
                    placeholder="0"
                    className="flex-1 bg-transparent text-sm font-semibold text-black outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 px-3 py-3 bg-gray-50 rounded-xl border-[2px] border-gray-200 focus-within:border-black">
                  <span className="text-gray-500 text-xs">Pago S/</span>
                  <input
                    type="number"
                    value={form.monthlyPayment}
                    onChange={(e) => setForm((f) => ({ ...f, monthlyPayment: e.target.value }))}
                    placeholder="0"
                    className="flex-1 bg-transparent text-sm font-semibold text-black outline-none"
                  />
                </div>
                <input
                  type="text"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  placeholder="Vencimiento (ej: 25 oct)"
                  className="px-3 py-3 bg-gray-50 rounded-xl border-[2px] border-gray-200 text-sm text-black placeholder-gray-400 outline-none focus:border-black transition-colors"
                />
              </div>
              {formError && (
                <p role="alert" className="text-sm font-semibold text-red-600">
                  {formError}
                </p>
              )}
              <button
                onClick={handleSave}
                disabled={!form.name || saving}
                className="w-full py-3.5 bg-[#FFD43B] text-black font-black rounded-xl border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : editingDebt ? 'Guardar cambios' : 'Agregar deuda'}
              </button>
            </div>
          </div>
        </div>
      )}
      {paying && (
        <AccountPickerModal
          title={`Pagar ${paying.name}`}
          amount={payAmountNum}
          confirmLabel={payAmountNum > 0 ? `Pagar S/ ${payAmountNum.toFixed(2)}` : 'Pagar'}
          onConfirm={confirmPay}
          onClose={() => setPaying(null)}
          validate={() =>
            payAmountNum > 0 && payAmountNum <= paying.balance
              ? null
              : `Ingresa un monto mayor que 0 y hasta S/ ${paying.balance.toFixed(2)}.`
          }
          header={<PayAmountChooser debt={paying} value={payAmount} onChange={setPayAmount} />}
        />
      )}
    </div>
  );
}

// Amount to pay: quick options (monthly installment / full balance) or any partial amount.
function PayAmountChooser({
  debt,
  value,
  onChange,
}: {
  debt: Debt;
  value: string;
  onChange: (v: string) => void;
}) {
  const options = [
    ...(debt.monthlyPayment > 0 && debt.monthlyPayment < debt.balance
      ? [{ label: 'Cuota mensual', amount: debt.monthlyPayment }]
      : []),
    { label: 'Pago total', amount: debt.balance },
  ];
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600">
        Saldo actual: <span className="font-black text-black">S/ {debt.balance.toFixed(2)}</span>
      </p>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => onChange(String(o.amount))}
            className={`flex-1 py-2 rounded-xl border-[2px] text-xs font-black transition-all ${
              parseFloat(value) === o.amount
                ? 'bg-[#FFD43B] border-black text-black'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {o.label}
            <span className="block font-bold">S/ {o.amount.toFixed(2)}</span>
          </button>
        ))}
      </div>
      <label className="block text-xs font-black text-black uppercase tracking-wide">
        Monto a pagar (S/)
      </label>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-[2px] border-gray-200 text-sm text-black font-bold outline-none focus:border-black transition-colors"
      />
    </div>
  );
}
