'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LoadError from '@/components/ui/LoadError';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage, toDataError } from '@/lib/dataError';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { deleteMyAccount } from '@/lib/accountDeletion';
import {
  LogOut,
  Mail,
  Calendar,
  Shield,
  Bell,
  Database,
  Info,
  ChevronRight,
  Check,
  Globe,
} from 'lucide-react';
import { userSettingsService, exchangeRatesService } from '@/lib/supabaseCurrency';
import { getCurrencyInfo, CURRENCIES, getDefaultRate } from '@/lib/currency';
import { createClient } from '@/lib/supabase/client';
import { adminService } from '@/lib/supabaseAdmin';
import CompanionDevices from '@/components/companion/CompanionDevices';
import { APP_LOCALE } from '@/lib/locale';

export default function ConfiguracionPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [baseCurrency, setBaseCurrency] = useState('PEN');
  const [exchangeRateMode, setExchangeRateMode] = useState<'manual' | 'automatic'>('manual');
  const [showEquivalents, setShowEquivalents] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [stats, setStats] = useState({ transactions: 0, payments: 0, subscriptions: 0, goals: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [ratesMap, setRatesMap] = useState<Record<string, number>>({});
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [usedCurrencies, setUsedCurrencies] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [settingsError, setSettingsError] = useState('');
  const [rateError, setRateError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const toast = useToast();
  // Administrators get a shortcut to the admin panel.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    adminService
      .isAdmin()
      .then(setIsAdmin)
      .catch(() => setIsAdmin(false));
  }, []);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoadingStats(true);
    setLoadingSettings(true);
    setLoadError(null);
    try {
      const [settings, rates, txRes, payRes, subRes, goalRes, accsRes] = await Promise.all([
        userSettingsService.get(),
        exchangeRatesService.getRatesMap(),
        supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user!.id),
        supabase.from('pagos').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase
          .from('subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user!.id),
        supabase
          .from('savings_goals')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user!.id),
        supabase.from('accounts').select('currency').eq('user_id', user!.id),
      ]);
      for (const res of [txRes, payRes, subRes, goalRes, accsRes]) {
        if (res.error) throw toDataError(res.error);
      }
      setBaseCurrency(settings.baseCurrencyCode);
      setExchangeRateMode(settings.exchangeRateMode);
      setShowEquivalents(settings.showEquivalents);
      setRatesMap(rates);
      setStats({
        transactions: txRes.count || 0,
        payments: payRes.count || 0,
        subscriptions: subRes.count || 0,
        goals: goalRes.count || 0,
      });
      // Get unique currencies from accounts
      const currencies = [
        ...new Set(
          (accsRes.data || []).map((a: { currency: string | null }) => a.currency || 'PEN')
        ),
      ];
      setUsedCurrencies(currencies as string[]);
    } catch (e) {
      console.error(e);
      setLoadError(e);
    }
    setLoadingStats(false);
    setLoadingSettings(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleSaveSettings() {
    setSavingSettings(true);
    setSettingsError('');
    try {
      await userSettingsService.upsert({
        baseCurrencyCode: baseCurrency,
        exchangeRateMode,
        showEquivalents,
      });
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    } catch (e) {
      console.error(e);
      setSettingsError(getErrorMessage(e));
    }
    setSavingSettings(false);
  }

  async function handleSaveRate(from: string, to: string) {
    const rate = parseFloat(rateInput);
    if (!rate || rate <= 0) return;
    setRateError('');
    try {
      await exchangeRatesService.upsert(from, to, rate);
      setRatesMap((prev) => ({ ...prev, [`${from}_${to}`]: rate }));
      setEditingRate(null);
      setRateInput('');
    } catch (e) {
      // Keep the editor open so the user can retry.
      console.error(e);
      setRateError(getErrorMessage(e));
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteMyAccount();
      try {
        await signOut();
      } catch {
        // The account no longer exists; the local session is cleared anyway.
      }
      router.replace('/');
    } catch (e) {
      console.error(e);
      setDeleteError(getErrorMessage(e));
      setDeleting(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      router.replace('/');
    } catch (e) {
      toast.showError(e);
    }
  }

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'U';
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(APP_LOCALE, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`w-12 h-6 rounded-full border-[3px] border-black transition-all relative flex-shrink-0 shadow-[2px_2px_0px_#000] ${value ? 'bg-[#4ADE80]' : 'bg-gray-200'}`}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 bg-white border-[2px] border-black rounded-full shadow transition-all ${value ? 'left-5' : 'left-0.5'}`}
      />
    </button>
  );

  // Currencies to show exchange rates for (non-base currencies used in accounts)
  const foreignCurrencies = usedCurrencies.filter((c) => c !== baseCurrency);

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-block bg-[#FFD43B] border-[3px] border-black rounded-2xl px-4 py-1 shadow-[4px_4px_0px_#000] mb-3">
          <span className="text-xs font-black text-black uppercase tracking-widest">
            ⚙️ Ajustes
          </span>
        </div>
        <h1 className="text-3xl font-black text-black uppercase tracking-tight">CONFIGURACIÓN</h1>
        <p className="text-sm font-bold text-gray-500 mt-1">Tu cuenta y preferencias</p>
      </div>

      {/* Profile Card */}
      <div className="bg-[#DCFCE7] border-[3px] border-black rounded-2xl p-5 shadow-[6px_6px_0px_#000] mb-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#4ADE80] border-[3px] border-black flex items-center justify-center text-2xl font-black text-black shadow-[3px_3px_0px_#000] flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-black text-lg uppercase truncate">
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <Mail className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
              <p className="text-sm font-bold text-black truncate">{user?.email || '—'}</p>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-gray-600" strokeWidth={2.5} />
              <p className="text-xs font-bold text-gray-600">Miembro desde {memberSince}</p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <div className="bg-[#FFD43B] border-[3px] border-black rounded-xl px-2 py-1 shadow-[2px_2px_0px_#000]">
              <Shield className="w-4 h-4 text-black" strokeWidth={2.5} />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          // "—" (not 0) when loading failed: a failed count is not "no data".
          {
            label: 'Movimientos',
            value: loadingStats ? '…' : loadError ? '—' : stats.transactions,
            color: 'bg-[#DBEAFE]',
          },
          {
            label: 'Pagos',
            value: loadingStats ? '…' : loadError ? '—' : stats.payments,
            color: 'bg-[#FEE2E2]',
          },
          {
            label: 'Suscripciones',
            value: loadingStats ? '…' : loadError ? '—' : stats.subscriptions,
            color: 'bg-[#F3E8FF]',
          },
          {
            label: 'Metas',
            value: loadingStats ? '…' : loadError ? '—' : stats.goals,
            color: 'bg-[#FEF9C3]',
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`${s.color} border-[3px] border-black rounded-2xl p-3 shadow-[4px_4px_0px_#000] text-center`}
          >
            <p className="text-xl font-black text-black">{s.value}</p>
            <p className="text-[10px] font-black text-black uppercase leading-tight mt-0.5">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── FINANZAS SECTION ── */}
      <div className="bg-white border-[3px] border-black rounded-2xl p-5 shadow-[6px_6px_0px_#000] mb-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-[#FFD43B] border-[3px] border-black rounded-xl flex items-center justify-center shadow-[2px_2px_0px_#000]">
            <Globe className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <p className="text-sm font-black text-black uppercase tracking-wide">
            Finanzas · Multimoneda
          </p>
        </div>

        {loadingSettings ? (
          <div className="animate-pulse space-y-3">
            <div className="h-10 bg-gray-100 rounded-xl" />
            <div className="h-10 bg-gray-100 rounded-xl" />
          </div>
        ) : loadError ? (
          // Hide the form: saving the defaults shown here would overwrite the real settings.
          <LoadError what="tu configuración" error={loadError} onRetry={fetchAll} />
        ) : (
          <div className="space-y-5">
            {/* Moneda principal */}
            <div>
              <p className="text-xs font-black text-black uppercase mb-1">Moneda principal</p>
              <p className="text-xs text-gray-500 mb-3">
                Usaremos esta moneda para mostrar tus totales y reportes.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CURRENCIES.slice(0, 4).map((c) => (
                  <button
                    key={c.code}
                    onClick={() => setBaseCurrency(c.code)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold border-[3px] border-black transition-all shadow-[3px_3px_0px_#000] active:shadow-none active:translate-y-0.5 ${
                      baseCurrency === c.code
                        ? 'bg-[#FFD43B] text-black'
                        : 'bg-white text-black hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-base">{c.flag}</span>
                    <div className="text-left">
                      <p className="text-xs font-black">{c.code}</p>
                      <p className="text-[10px] text-gray-600">{c.symbol}</p>
                    </div>
                    {baseCurrency === c.code && (
                      <Check className="w-3.5 h-3.5 ml-auto text-black" strokeWidth={3} />
                    )}
                  </button>
                ))}
              </div>
              {baseCurrency && (
                <div className="mt-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <p className="text-xs text-yellow-800 font-semibold">
                    {getCurrencyInfo(baseCurrency).flag} Moneda activa:{' '}
                    {getCurrencyInfo(baseCurrency).name} ({baseCurrency} ·{' '}
                    {getCurrencyInfo(baseCurrency).symbol})
                  </p>
                  <p className="text-xs text-yellow-600 mt-0.5">
                    Cambiar la moneda principal no modifica los datos históricos.
                  </p>
                </div>
              )}
            </div>

            {/* Tipo de cambio */}
            <div>
              <p className="text-xs font-black text-black uppercase mb-1">Tipo de cambio</p>
              <div className="flex gap-2 mb-3">
                {(['manual', 'automatic'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setExchangeRateMode(mode)}
                    className={`flex-1 py-2 rounded-xl text-xs font-black border-[3px] border-black transition-all shadow-[2px_2px_0px_#000] active:shadow-none ${
                      exchangeRateMode === mode
                        ? 'bg-[#FFD43B] text-black'
                        : 'bg-white text-black hover:bg-gray-50'
                    }`}
                  >
                    {mode === 'manual' ? '✏️ Manual' : '🔄 Automático'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mb-3">
                {exchangeRateMode === 'manual'
                  ? 'Ingresa manualmente el tipo de cambio de referencia.'
                  : 'Usar tipo de cambio de referencia (próximamente con fuente externa).'}
              </p>

              {/* Exchange rates for foreign currencies */}
              {foreignCurrencies.length > 0 ? (
                <div className="space-y-2">
                  {foreignCurrencies.map((fc) => {
                    const ci = getCurrencyInfo(fc);
                    const bci = getCurrencyInfo(baseCurrency);
                    const rateKey = `${fc}_${baseCurrency}`;
                    const currentRate = ratesMap[rateKey] || getDefaultRate(fc, baseCurrency);
                    const isEditing = editingRate === rateKey;
                    return (
                      <div
                        key={fc}
                        className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl border-[2px] border-black"
                      >
                        <span className="text-base">{ci.flag}</span>
                        <div className="flex-1">
                          <p className="text-xs font-black text-black">
                            1 {fc} = ? {baseCurrency}
                          </p>
                          {isEditing ? (
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="number"
                                step="0.001"
                                value={rateInput}
                                onChange={(e) => setRateInput(e.target.value)}
                                placeholder={String(currentRate)}
                                className="w-24 px-2 py-1 text-sm border-[2px] border-black rounded-lg outline-none bg-white"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveRate(fc, baseCurrency)}
                                className="px-3 py-1 bg-[#4ADE80] border-[2px] border-black rounded-lg text-xs font-black"
                              >
                                OK
                              </button>
                              <button
                                onClick={() => {
                                  setEditingRate(null);
                                  setRateInput('');
                                }}
                                className="px-2 py-1 bg-gray-200 border-[2px] border-black rounded-lg text-xs font-black"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-600 mt-0.5">
                              {bci.symbol}
                              {currentRate.toFixed(4)}
                            </p>
                          )}
                        </div>
                        {!isEditing && (
                          <button
                            onClick={() => {
                              setEditingRate(rateKey);
                              setRateInput(String(currentRate));
                            }}
                            className="px-2 py-1 bg-white border-[2px] border-black rounded-lg text-xs font-black hover:bg-gray-100 transition-colors"
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {rateError && (
                    <p role="alert" className="text-xs font-bold text-red-600">
                      {rateError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-xs text-blue-700 font-semibold">
                    💡 Los tipos de cambio aparecerán aquí cuando tengas cuentas en diferentes
                    monedas.
                  </p>
                </div>
              )}
            </div>

            {/* Show equivalents toggle */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-black">Mostrar equivalentes</p>
                <p className="text-xs font-bold text-gray-500 mt-0.5">
                  Mostrar montos en {baseCurrency} en cuentas y movimientos de otras monedas
                </p>
              </div>
              <Toggle
                value={showEquivalents}
                onChange={() => setShowEquivalents(!showEquivalents)}
              />
            </div>

            {settingsError && (
              <p role="alert" className="text-xs font-bold text-red-600">
                {settingsError}
              </p>
            )}

            {/* Save button */}
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className={`w-full py-3 rounded-2xl border-[3px] border-black text-sm font-black uppercase tracking-wide shadow-[4px_4px_0px_#000] active:shadow-none active:translate-y-0.5 transition-all ${
                savedFeedback
                  ? 'bg-[#4ADE80] text-black'
                  : 'bg-[#FFD43B] text-black hover:bg-yellow-300'
              } disabled:opacity-50`}
            >
              {savedFeedback
                ? '✅ Guardado'
                : savingSettings
                  ? 'Guardando...'
                  : 'Guardar configuración'}
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="bg-white border-[3px] border-black rounded-2xl p-5 shadow-[6px_6px_0px_#000] mb-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-[#DBEAFE] border-[3px] border-black rounded-xl flex items-center justify-center shadow-[2px_2px_0px_#000]">
            <Bell className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <p className="text-sm font-black text-black uppercase tracking-wide">Notificaciones</p>
        </div>
        <div className="space-y-4">
          {[
            {
              label: 'Notificaciones generales',
              sub: 'Recordatorios y alertas',
              value: notifications,
              onChange: () => setNotifications(!notifications),
            },
            {
              label: 'Alertas de presupuesto',
              sub: 'Cuando superes el 80% de una categoría',
              value: budgetAlerts,
              onChange: () => setBudgetAlerts(!budgetAlerts),
            },
            {
              label: 'Reporte semanal',
              sub: 'Resumen de tus finanzas cada lunes',
              value: weeklyReport,
              onChange: () => setWeeklyReport(!weeklyReport),
            },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-black">{item.label}</p>
                <p className="text-xs font-bold text-gray-500 mt-0.5">{item.sub}</p>
              </div>
              <Toggle value={item.value} onChange={item.onChange} />
            </div>
          ))}
        </div>
      </div>

      <CompanionDevices />

      {/* Data */}
      <div className="bg-[#FEF9C3] border-[3px] border-black rounded-2xl p-5 shadow-[6px_6px_0px_#000] mb-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-[#FFD43B] border-[3px] border-black rounded-xl flex items-center justify-center shadow-[2px_2px_0px_#000]">
            <Database className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <p className="text-sm font-black text-black uppercase tracking-wide">Datos</p>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Exportar datos (CSV)', icon: '📤' },
            { label: 'Importar transacciones', icon: '📥' },
            { label: 'Hacer copia de seguridad', icon: '☁️' },
          ].map((item) => (
            <button
              key={item.label}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border-[3px] border-black bg-white hover:bg-gray-50 transition-all shadow-[3px_3px_0px_#000] active:shadow-none active:translate-y-0.5 text-left"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm font-black text-black">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-black ml-auto" strokeWidth={2.5} />
            </button>
          ))}
        </div>
      </div>

      {/* App Info */}
      <div className="bg-white border-[3px] border-black rounded-2xl p-5 shadow-[6px_6px_0px_#000] mb-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-[#F3E8FF] border-[3px] border-black rounded-xl flex items-center justify-center shadow-[2px_2px_0px_#000]">
            <Info className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <p className="text-sm font-black text-black uppercase tracking-wide">Acerca de</p>
        </div>
        <div className="space-y-0">
          {[
            { label: 'Versión', value: '2.0.0' },
            {
              label: 'Moneda activa',
              value: `${getCurrencyInfo(baseCurrency).flag} ${baseCurrency} · ${getCurrencyInfo(baseCurrency).symbol}`,
            },
            {
              label: 'Tipo de cambio',
              value: exchangeRateMode === 'manual' ? 'Manual' : 'Automático',
            },
            { label: 'Idioma', value: 'Español' },
            { label: 'ID de cuenta', value: user?.id ? `${user.id.slice(0, 8)}…` : '—' },
          ].map((row, i, arr) => (
            <div
              key={row.label}
              className={`flex justify-between items-center py-3 ${i < arr.length - 1 ? 'border-b-[2px] border-black' : ''}`}
            >
              <span className="text-sm font-black text-black">{row.label}</span>
              <span className="text-sm font-bold text-gray-600">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Monedas utilizadas */}
      {usedCurrencies.length > 0 && (
        <div className="bg-white border-[3px] border-black rounded-2xl p-5 shadow-[6px_6px_0px_#000] mb-5">
          <p className="text-xs font-black text-black uppercase tracking-wide mb-3">
            Monedas utilizadas
          </p>
          <div className="flex flex-wrap gap-2">
            {usedCurrencies.map((c) => {
              const ci = getCurrencyInfo(c);
              return (
                <div
                  key={c}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-[3px] border-black text-xs font-black shadow-[2px_2px_0px_#000] ${c === baseCurrency ? 'bg-[#FFD43B]' : 'bg-white'}`}
                >
                  <span>{ci.flag}</span>
                  <span>{c}</span>
                  {c === baseCurrency && (
                    <span className="text-[10px] text-gray-600">principal</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isAdmin && (
        <Link
          href="/admin"
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-[3px] border-black bg-[#FFD43B] text-black font-black text-sm uppercase tracking-wide shadow-[6px_6px_0px_#000]"
        >
          Panel de administración
        </Link>
      )}

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-[3px] border-black bg-[#FEE2E2] text-black font-black text-sm uppercase tracking-wide shadow-[6px_6px_0px_#000] hover:bg-red-200 transition-all active:shadow-none active:translate-y-1"
      >
        <LogOut className="w-5 h-5" strokeWidth={2.5} />
        CERRAR SESIÓN
      </button>

      {/* Legal */}
      <div className="flex justify-center gap-4 text-xs font-bold text-black/60">
        <Link href="/privacidad" className="underline">
          Política de privacidad
        </Link>
        <Link href="/terminos" className="underline">
          Términos y condiciones
        </Link>
      </div>

      {/* Delete account */}
      <div className="rounded-2xl border-[3px] border-black bg-white p-4 shadow-[4px_4px_0px_#000] space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-red-700">Eliminar cuenta</p>
        <p className="text-sm text-black/70">
          Se borrarán para siempre tu cuenta y todos tus datos: cuentas, movimientos,
          transferencias, pagos, ingresos, metas y configuración. No se puede deshacer.
        </p>
        {!confirmingDelete ? (
          <button
            onClick={() => {
              setConfirmingDelete(true);
              setDeleteConfirmText('');
              setDeleteError('');
            }}
            className="w-full py-3 rounded-xl border-[3px] border-red-700 text-red-700 font-black text-sm uppercase"
          >
            Eliminar mi cuenta
          </button>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-black/70">
              Escribe ELIMINAR para confirmar
            </label>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              autoComplete="off"
              className="w-full px-3 py-2.5 rounded-xl border-[3px] border-black text-sm font-bold outline-none"
            />
            {deleteError && (
              <p role="alert" className="text-sm font-semibold text-red-600">
                {deleteError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl border-[3px] border-black font-black text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText.trim() !== 'ELIMINAR'}
                className="flex-1 py-3 rounded-xl border-[3px] border-black bg-red-600 text-white font-black text-sm disabled:opacity-50"
              >
                {deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
