'use client';
import React, { useState, useEffect } from 'react';
import { investmentsService, Investment } from '@/lib/supabaseFinance';
import { Plus, X, Pencil, Trash2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

const INVESTMENT_TYPES = ['Acciones', 'ETF', 'Fondo mutuo', 'Cripto', 'Bonos', 'Otro'];

export default function InversionesPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingInv, setEditingInv] = useState<Investment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', ticker: '', type: 'Acciones', shares: '', price: '', cost: '', icon: '📈', color: '#16A34A' });

  useEffect(() => {
    investmentsService.getAll().then(setInvestments).catch(console.error).finally(() => setLoading(false));
  }, []);

  const totalValue = investments.reduce((s, i) => s + (i.shares * i.price), 0);
  const totalCost = investments.reduce((s, i) => s + i.cost, 0);
  const totalGain = totalValue - totalCost;
  const returnPct = totalCost > 0 ? ((totalGain / totalCost) * 100).toFixed(1) : '0.0';

  const openAdd = () => {
    setEditingInv(null);
    setForm({ name: '', ticker: '', type: 'Acciones', shares: '', price: '', cost: '', icon: '📈', color: '#16A34A' });
    setShowForm(true);
  };

  const openEdit = (inv: Investment) => {
    setEditingInv(inv);
    setForm({ name: inv.name, ticker: inv.ticker, type: inv.type, shares: String(inv.shares), price: String(inv.price), cost: String(inv.cost), icon: inv.icon, color: inv.color });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const typeIcons: Record<string, string> = { 'Acciones': '📈', 'ETF': '📊', 'Fondo mutuo': '🏛️', 'Cripto': '₿', 'Bonos': '📋', 'Otro': '💼' };
      const invData: Omit<Investment, 'id'> = {
        name: form.name, ticker: form.ticker, type: form.type,
        shares: parseFloat(form.shares) || 0, price: parseFloat(form.price) || 0,
        cost: parseFloat(form.cost) || 0, icon: typeIcons[form.type] || '📈', color: '#16A34A',
      };
      if (editingInv) {
        await investmentsService.update(editingInv.id, invData);
        setInvestments(prev => prev.map(i => i.id === editingInv.id ? { ...i, ...invData } : i));
      } else {
        const created = await investmentsService.create(invData);
        if (created) setInvestments(prev => [...prev, created]);
      }
      setShowForm(false);
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await investmentsService.delete(id);
      setInvestments(prev => prev.filter(i => i.id !== id));
    } catch (err) { console.error(err); }
  };

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-manrope font-800 text-fin-text">Inversiones</h1>
        <button
          onClick={openAdd}
          className="group flex items-center gap-2 px-3 py-2 bg-fin-green text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-all duration-200"
        >
          <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
          Agregar
        </button>
      </div>

      {investments.length > 0 && (
        <div className="bg-white rounded-2xl border border-fin-border p-5 shadow-fin-card mb-5">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-gray-500" strokeWidth={1.75} />
            <p className="text-xs text-fin-muted">Valor del portafolio</p>
          </div>
          <p className="text-3xl font-manrope font-800 text-fin-text mb-3">S/ {totalValue.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
          <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-50">
            <div><p className="text-xs text-fin-muted mb-1">Invertido</p><p className="text-sm font-manrope font-700 text-fin-text">S/ {totalCost.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p></div>
            <div>
              <p className="text-xs text-fin-muted mb-1">Ganancia</p>
              <div className="flex items-center gap-1">
                {totalGain >= 0
                  ? <TrendingUp className="w-3 h-3 text-green-600" strokeWidth={2} />
                  : <TrendingDown className="w-3 h-3 text-red-500" strokeWidth={2} />}
                <p className={`text-sm font-manrope font-700 ${totalGain >= 0 ? 'text-fin-green' : 'text-fin-red'}`}>{totalGain >= 0 ? '+' : ''}S/ {totalGain.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div><p className="text-xs text-fin-muted mb-1">Retorno</p><p className={`text-sm font-manrope font-700 ${Number(returnPct) >= 0 ? 'text-fin-green' : 'text-fin-red'}`}>{Number(returnPct) >= 0 ? '+' : ''}{returnPct}%</p></div>
          </div>
        </div>
      )}

      {investments.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <TrendingUp className="w-12 h-12 text-gray-200 mb-3" strokeWidth={1.25} />
          <p className="text-gray-500 font-medium mb-1">Sin inversiones registradas</p>
          <p className="text-sm text-gray-400 mb-4">Agrega tus inversiones para ver tu portafolio</p>
          <button onClick={openAdd} className="group flex items-center gap-2 px-4 py-2 bg-fin-green text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-all duration-200">
            <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
            Agregar inversión
          </button>
        </div>
      )}

      {investments.length > 0 && (
        <>
          <p className="text-xs font-semibold text-fin-muted uppercase tracking-wide mb-3">Activos</p>
          <div className="space-y-3">
            {investments.map(inv => {
              const currentValue = inv.shares * inv.price;
              const gain = currentValue - inv.cost;
              const gainPct = inv.cost > 0 ? ((gain / inv.cost) * 100).toFixed(1) : '0.0';
              return (
                <div key={inv.id} className="bg-white rounded-2xl border border-fin-border p-4 shadow-fin-card hover:shadow-fin-card-hover transition-shadow group">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: '#DCFCE7' }}>{inv.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-manrope font-700 text-fin-text">{inv.name}</p>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-fin-muted">{inv.type}</span>
                      </div>
                      <p className="text-xs text-fin-muted mt-0.5">{inv.ticker} · {inv.shares} unidades</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-manrope font-700 text-fin-text">S/ {currentValue.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                        <p className={`text-xs font-semibold ${Number(gainPct) >= 0 ? 'text-fin-green' : 'text-fin-red'}`}>{Number(gainPct) >= 0 ? '+' : ''}{gainPct}%</p>
                      </div>
                      <div className="hidden group-hover:flex items-center gap-1">
                        <button onClick={() => openEdit(inv)} className="group p-1.5 rounded-lg hover:bg-gray-100 transition-all duration-150">
                          <Pencil className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-700 transition-colors" strokeWidth={1.75} />
                        </button>
                        <button onClick={() => handleDelete(inv.id)} className="group p-1.5 rounded-lg hover:bg-red-50 transition-all duration-150">
                          <Trash2 className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-500 transition-colors" strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editingInv ? 'Editar inversión' : 'Nueva inversión'}</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all hover:rotate-90 duration-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 max-h-[80vh] overflow-y-auto">
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nombre (ej: Credicorp, Bitcoin)"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-fin-text placeholder-gray-400 outline-none focus:border-fin-green transition-colors" />
              <input type="text" value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
                placeholder="Ticker / símbolo (ej: BAP, BTC)"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-fin-text placeholder-gray-400 outline-none focus:border-fin-green transition-colors" />
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-fin-text outline-none focus:border-fin-green transition-colors">
                {INVESTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-fin-muted px-1">Unidades</span>
                  <input type="number" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))}
                    placeholder="0" className="px-3 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-fin-text outline-none focus:border-fin-green transition-colors" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-fin-muted px-1">Precio S/</span>
                  <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0" className="px-3 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-fin-text outline-none focus:border-fin-green transition-colors" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-fin-muted px-1">Costo S/</span>
                  <input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                    placeholder="0" className="px-3 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-fin-text outline-none focus:border-fin-green transition-colors" />
                </div>
              </div>
              <button onClick={handleSave} disabled={!form.name}
                className="w-full py-3.5 bg-fin-green text-white font-manrope font-700 rounded-xl hover:bg-green-700 transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed">
                {editingInv ? 'Guardar cambios' : 'Agregar inversión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
