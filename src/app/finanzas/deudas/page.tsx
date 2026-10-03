'use client';
import React, { useState, useEffect } from 'react';
import { debtsService, Debt } from '@/lib/supabaseFinance';
import { Plus, X, Pencil, Trash2, CreditCard, AlertCircle } from 'lucide-react';

const DEBT_TYPES = ['Tarjeta de crédito', 'Préstamo personal', 'Préstamo hipotecario', 'Préstamo vehicular', 'Otro'];

export default function DeudasPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', institution: '', icon: '💳', balance: '', limit: '', monthlyPayment: '', dueDate: '', type: 'Tarjeta de crédito', color: '#DC2626', interestRate: '' });

  useEffect(() => {
    debtsService.getAll().then(setDebts).catch(console.error).finally(() => setLoading(false));
  }, []);

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const nextPayment = debts.filter(d => d.balance > 0 && d.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  const openAdd = () => {
    setEditingDebt(null);
    setForm({ name: '', institution: '', icon: '💳', balance: '', limit: '', monthlyPayment: '', dueDate: '', type: 'Tarjeta de crédito', color: '#DC2626', interestRate: '' });
    setShowForm(true);
  };

  const openEdit = (debt: Debt) => {
    setEditingDebt(debt);
    setForm({ name: debt.name, institution: debt.institution, icon: debt.icon, balance: String(debt.balance), limit: String(debt.limit), monthlyPayment: String(debt.monthlyPayment), dueDate: debt.dueDate, type: debt.type, color: debt.color, interestRate: String(debt.interestRate) });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const debtData: Omit<Debt, 'id'> = {
        name: form.name, institution: form.institution,
        icon: form.type === 'Tarjeta de crédito' ? '💳' : '🏦',
        balance: parseFloat(form.balance) || 0, limit: parseFloat(form.limit) || 0,
        monthlyPayment: parseFloat(form.monthlyPayment) || 0, dueDate: form.dueDate,
        type: form.type, color: '#DC2626', interestRate: parseFloat(form.interestRate) || 0,
      };
      if (editingDebt) {
        await debtsService.update(editingDebt.id, debtData);
        setDebts(prev => prev.map(d => d.id === editingDebt.id ? { ...d, ...debtData } : d));
      } else {
        const created = await debtsService.create(debtData);
        if (created) setDebts(prev => [...prev, created]);
      }
      setShowForm(false);
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await debtsService.delete(id);
      setDebts(prev => prev.filter(d => d.id !== id));
    } catch (err) { console.error(err); }
  };

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-manrope font-800 text-fin-text">Deudas</h1>
        <button
          onClick={openAdd}
          className="group flex items-center gap-2 px-3 py-2 bg-fin-red text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-all duration-200"
        >
          <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
          Agregar deuda
        </button>
      </div>

      {debts.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-100 p-5 mb-5 shadow-fin-card">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-500" strokeWidth={1.75} />
            <p className="text-sm text-fin-muted">Total deudas</p>
          </div>
          <p className="text-3xl font-manrope font-800 text-fin-red">S/ {totalDebt.toFixed(2)}</p>
          {nextPayment && <p className="text-sm text-fin-muted mt-1">Próximo pago: <span className="font-semibold text-fin-text">{nextPayment.dueDate} · S/ {nextPayment.monthlyPayment.toFixed(2)}</span></p>}
        </div>
      )}

      {debts.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CreditCard className="w-12 h-12 text-gray-200 mb-3" strokeWidth={1.25} />
          <p className="text-gray-500 font-medium mb-1">Sin deudas registradas</p>
          <p className="text-sm text-gray-400 mb-4">Registra tus deudas para llevar un control</p>
          <button onClick={openAdd} className="group flex items-center gap-2 px-4 py-2 bg-fin-red text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-all duration-200">
            <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
            Agregar deuda
          </button>
        </div>
      )}

      {debts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-3xl mb-4">💳</div>
          <h2 className="text-lg font-manrope font-800 text-fin-text mb-2">Sin deudas registradas</h2>
          <p className="text-sm text-fin-muted max-w-xs mb-6">Registra tus tarjetas de crédito y préstamos para hacer seguimiento de tus pagos.</p>
          <button onClick={openAdd} className="px-5 py-3 bg-fin-red text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors">
            Agregar primera deuda
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {debts.map(debt => {
            const usedPct = debt.limit > 0 ? Math.round((debt.balance / debt.limit) * 100) : 0;
            return (
              <div key={debt.id} className="bg-white rounded-2xl border border-fin-border p-5 shadow-fin-card hover:shadow-fin-card-hover transition-shadow group">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: '#FEE2E2' }}>{debt.icon}</div>
                  <div className="flex-1">
                    <p className="font-manrope font-700 text-fin-text">{debt.name}</p>
                    <p className="text-xs text-fin-muted">{debt.institution} · {debt.type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="font-manrope font-700 text-fin-red">S/ {debt.balance.toFixed(2)}</p>
                      <p className="text-xs text-fin-muted">saldo</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(debt)} className="group p-1.5 rounded-lg hover:bg-gray-100 transition-all duration-150">
                        <Pencil className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-700 transition-colors" strokeWidth={1.75} />
                      </button>
                      <button onClick={() => handleDelete(debt.id)} className="group p-1.5 rounded-lg hover:bg-red-50 transition-all duration-150">
                        <Trash2 className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-500 transition-colors" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4 py-3 border-y border-gray-50">
                  <div><p className="text-xs text-fin-muted mb-1">Límite</p><p className="text-sm font-semibold text-fin-text">S/ {debt.limit.toLocaleString('es-PE')}</p></div>
                  <div><p className="text-xs text-fin-muted mb-1">Pago mensual</p><p className="text-sm font-semibold text-fin-text">S/ {debt.monthlyPayment.toFixed(2)}</p></div>
                  <div><p className="text-xs text-fin-muted mb-1">Vencimiento</p><p className="text-sm font-semibold text-fin-text">{debt.dueDate || '—'}</p></div>
                </div>
                {debt.limit > 0 && (
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-fin-muted">Uso del crédito</span>
                      <span className="font-semibold" style={{ color: usedPct > 70 ? '#DC2626' : '#16A34A' }}>{usedPct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(usedPct, 100)}%`, background: usedPct > 70 ? '#DC2626' : '#16A34A' }} />
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editingDebt ? 'Editar deuda' : 'Nueva deuda'}</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all hover:rotate-90 duration-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 max-h-[80vh] overflow-y-auto">
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nombre (ej: Tarjeta BCP Visa)"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-fin-text placeholder-gray-400 outline-none focus:border-fin-green transition-colors" />
              <input type="text" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
                placeholder="Institución (ej: BCP, Interbank)"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-fin-text placeholder-gray-400 outline-none focus:border-fin-green transition-colors" />
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-fin-text outline-none focus:border-fin-green transition-colors">
                {DEBT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 px-3 py-3 bg-gray-50 rounded-xl border border-fin-border">
                  <span className="text-fin-muted text-xs">Saldo S/</span>
                  <input type="number" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))}
                    placeholder="0" className="flex-1 bg-transparent text-sm font-semibold text-fin-text outline-none" />
                </div>
                <div className="flex items-center gap-2 px-3 py-3 bg-gray-50 rounded-xl border border-fin-border">
                  <span className="text-fin-muted text-xs">Límite S/</span>
                  <input type="number" value={form.limit} onChange={e => setForm(f => ({ ...f, limit: e.target.value }))}
                    placeholder="0" className="flex-1 bg-transparent text-sm font-semibold text-fin-text outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 px-3 py-3 bg-gray-50 rounded-xl border border-fin-border">
                  <span className="text-fin-muted text-xs">Pago S/</span>
                  <input type="number" value={form.monthlyPayment} onChange={e => setForm(f => ({ ...f, monthlyPayment: e.target.value }))}
                    placeholder="0" className="flex-1 bg-transparent text-sm font-semibold text-fin-text outline-none" />
                </div>
                <input type="text" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  placeholder="Vencimiento (ej: 25 oct)"
                  className="px-3 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-fin-text placeholder-gray-400 outline-none focus:border-fin-green transition-colors" />
              </div>
              <button onClick={handleSave} disabled={!form.name}
                className="w-full py-3.5 bg-fin-red text-white font-manrope font-700 rounded-xl hover:bg-red-700 transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed">
                {editingDebt ? 'Guardar cambios' : 'Agregar deuda'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
