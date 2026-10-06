'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, Camera, Copy, Check, AlertTriangle, Banknote } from 'lucide-react';
import {
  juntasService,
  juntaMembersService,
  juntaCyclesService,
  juntaTurnsService,
  juntaContributionsService,
  juntaEventsService,
  type Junta,
  type JuntaMember,
  type JuntaCycle,
  type JuntaTurn,
} from '@/lib/supabaseJuntas';
import { accountsService } from '@/lib/supabaseFinance';
import type { Account } from '@/lib/financeStore';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';

type PaymentTab = 'yape' | 'plin' | 'transferencia' | 'efectivo';

const PAYMENT_TABS: { key: PaymentTab; label: string; emoji: string }[] = [
  { key: 'yape', label: 'Yape', emoji: '💜' },
  { key: 'plin', label: 'Plin', emoji: '💚' },
  { key: 'transferencia', label: 'Transferencia', emoji: '🏦' },
  { key: 'efectivo', label: 'Efectivo', emoji: '💵' },
];

// Simple QR placeholder using CSS
function QRPlaceholder({ value, size = 140 }: { value: string; size?: number }) {
  // Generate a deterministic pattern from the value string
  const cells = 10;
  const pattern: boolean[][] = Array.from({ length: cells }, (_, row) =>
    Array.from({ length: cells }, (_, col) => {
      const hash = (value.charCodeAt((row * cells + col) % value.length) + row * 7 + col * 13) % 3;
      return hash !== 0;
    })
  );

  return (
    <div
      className="border-[3px] border-black rounded-xl overflow-hidden bg-white p-2 inline-block"
      style={{ width: size, height: size }}
    >
      <div
        className="w-full h-full grid"
        style={{ gridTemplateColumns: `repeat(${cells}, 1fr)`, gap: 1 }}
      >
        {pattern.flat().map((filled, i) => (
          <div key={i} className={`rounded-[1px] ${filled ? 'bg-black' : 'bg-white'}`} />
        ))}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 bg-gray-100 border border-gray-300 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

// ── Payment Method Panels ─────────────────────────────────────────────────────

function YapePanel({ accounts, recipientName }: { accounts: Account[]; recipientName: string }) {
  const yapeAccounts = accounts.filter(
    (a) =>
      a.type === 'digital' &&
      (a.institution?.toLowerCase().includes('yape') || a.name?.toLowerCase().includes('yape'))
  );
  const phone = yapeAccounts[0]?.institution?.replace(/[^0-9]/g, '') || '9XXXXXXXX';
  const qrValue = `yape:${phone}:${recipientName}`;

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="text-center">
        <p className="text-xs font-black text-gray-500 uppercase tracking-wide mb-1">
          Código QR de Yape
        </p>
        <p className="text-sm font-bold text-gray-700">{recipientName}</p>
      </div>
      <QRPlaceholder value={qrValue} size={160} />
      <div className="flex items-center gap-3 bg-purple-50 border-2 border-purple-200 rounded-2xl px-5 py-3">
        <span className="text-2xl">💜</span>
        <div>
          <p className="text-xs font-black text-purple-600 uppercase tracking-wide">Número Yape</p>
          <p className="text-lg font-black text-black">{phone}</p>
        </div>
        <CopyButton text={phone} />
      </div>
      {yapeAccounts.length === 0 && (
        <p className="text-xs text-gray-400 font-medium text-center">
          El receptor no tiene Yape registrado. Usa otro método.
        </p>
      )}
    </div>
  );
}

function PlinPanel({ accounts, recipientName }: { accounts: Account[]; recipientName: string }) {
  const plinAccounts = accounts.filter(
    (a) =>
      a.type === 'digital' &&
      (a.institution?.toLowerCase().includes('plin') || a.name?.toLowerCase().includes('plin'))
  );
  const phone = plinAccounts[0]?.institution?.replace(/[^0-9]/g, '') || '9XXXXXXXX';
  const qrValue = `plin:${phone}:${recipientName}`;

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="text-center">
        <p className="text-xs font-black text-gray-500 uppercase tracking-wide mb-1">
          Código QR de Plin
        </p>
        <p className="text-sm font-bold text-gray-700">{recipientName}</p>
      </div>
      <QRPlaceholder value={qrValue} size={160} />
      <div className="flex items-center gap-3 bg-green-50 border-2 border-green-200 rounded-2xl px-5 py-3">
        <span className="text-2xl">💚</span>
        <div>
          <p className="text-xs font-black text-green-600 uppercase tracking-wide">Número Plin</p>
          <p className="text-lg font-black text-black">{phone}</p>
        </div>
        <CopyButton text={phone} />
      </div>
      {plinAccounts.length === 0 && (
        <p className="text-xs text-gray-400 font-medium text-center">
          El receptor no tiene Plin registrado. Usa otro método.
        </p>
      )}
    </div>
  );
}

function TransferenciaPanel({ accounts }: { accounts: Account[] }) {
  const bankAccounts = accounts.filter((a) => a.type === 'banco');

  if (bankAccounts.length === 0) {
    return (
      <div className="py-6 text-center">
        <div className="w-14 h-14 bg-gray-100 border-2 border-black rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl">
          🏦
        </div>
        <p className="font-black text-black mb-1">Sin cuentas bancarias</p>
        <p className="text-sm text-gray-500">El receptor no tiene cuentas bancarias registradas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-2">
      {bankAccounts.map((acc) => (
        <div key={acc.id} className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: acc.bgColor || '#DBEAFE' }}
            >
              {acc.icon || '🏦'}
            </div>
            <div>
              <p className="font-black text-black text-sm">{acc.name}</p>
              <p className="text-xs text-gray-500 font-medium">{acc.institution}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-white border border-blue-200 rounded-xl px-3 py-2">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">
                  N° de cuenta
                </p>
                <p className="text-sm font-black text-black font-mono">{acc.institution || '—'}</p>
              </div>
              <CopyButton text={acc.institution || ''} />
            </div>
            <div className="flex items-center justify-between bg-white border border-blue-200 rounded-xl px-3 py-2">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">CCI</p>
                <p className="text-sm font-black text-black font-mono">
                  00{acc.institution?.replace(/\s/g, '') || '—'}
                </p>
              </div>
              <CopyButton text={`00${acc.institution?.replace(/\s/g, '') || ''}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EfectivoPanel() {
  return (
    <div className="py-4">
      <div className="bg-amber-50 border-[3px] border-amber-400 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-400 border-2 border-black rounded-xl flex items-center justify-center text-xl shrink-0">
            ⚠️
          </div>
          <div>
            <p className="font-black text-black text-sm mb-2">Pago en efectivo</p>
            <p className="text-sm text-gray-700 font-medium leading-relaxed">
              El aporte en efectivo quedará en <strong>estado pendiente</strong> hasta que la
              persona que recibe el dinero lo apruebe manualmente.
            </p>
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-100 border border-amber-300 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs font-bold text-amber-700">
                El receptor debe confirmar que recibió el efectivo para que el aporte sea válido.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Aporte Page ──────────────────────────────────────────────────────────

export default function AportePage() {
  const params = useParams();
  const router = useRouter();
  const juntaId = params.id as string;

  const [junta, setJunta] = useState<Junta | null>(null);
  const [members, setMembers] = useState<JuntaMember[]>([]);
  const [currentCycle, setCurrentCycle] = useState<JuntaCycle | null>(null);
  const [myMember, setMyMember] = useState<JuntaMember | null>(null);
  const [recipientMember, setRecipientMember] = useState<JuntaMember | null>(null);
  const [recipientAccounts, setRecipientAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const [amount, setAmount] = useState('');
  const [activeTab, setActiveTab] = useState<PaymentTab>('yape');
  const [notes, setNotes] = useState('');
  const [copiedField, setCopiedField] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const [j, m, c, t, accs] = await Promise.all([
          juntasService.getById(juntaId),
          juntaMembersService.getByJunta(juntaId),
          juntaCyclesService.getByJunta(juntaId),
          juntaTurnsService.getByJunta(juntaId),
          // Propagate failures: "no accounts" must not be shown when loading failed.
          accountsService.getAll(),
        ]);
        setJunta(j);
        setMembers(m);
        const active = c.find((cy) => cy.status === 'activo') || c[c.length - 1] || null;
        setCurrentCycle(active);
        if (j) setAmount(j.contributionAmount.toFixed(2));
        const me =
          m.find((mem) => mem.userId === user?.id) ||
          m.find((mem) => mem.role === 'admin') ||
          m[0] ||
          null;
        setMyMember(me);

        // Find who receives this turn (turn order 1 = proximo, or first turn)
        const currentTurn =
          t.find((turn) => turn.status === 'proximo') || t.find((turn) => turn.turnOrder === 1);
        if (currentTurn) {
          const recipient = m.find((mem) => mem.id === currentTurn.memberId) || null;
          setRecipientMember(recipient);
        } else if (active?.drawWinnerMemberId) {
          const recipient = m.find((mem) => mem.id === active.drawWinnerMemberId) || null;
          setRecipientMember(recipient);
        } else {
          // Default to admin/first member
          setRecipientMember(m.find((mem) => mem.role === 'admin') || m[0] || null);
        }

        setRecipientAccounts(accs);
      } catch (err) {
        console.error(err);
        setError(`Error al cargar los datos. ${getErrorMessage(err)}`);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [juntaId]);

  async function handleSave() {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Ingresa un monto válido.');
      return;
    }
    if (!currentCycle || !myMember) {
      setError('No se encontró el ciclo activo.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const isEfectivo = activeTab === 'efectivo';

      await juntaContributionsService.create({
        juntaId,
        cycleId: currentCycle.id,
        memberId: myMember.id,
        userId: user?.id || null,
        amount: parseFloat(amount),
        paymentMethod: activeTab,
        status: isEfectivo ? 'pendiente' : 'pagado',
        receiptUrl: '',
        notes,
        paidAt: isEfectivo ? null : new Date().toISOString(),
        transactionType: 'junta_contribution',
      });
      // From here on the contribution is saved: follow-up failures are warnings,
      // never a form error (retrying would duplicate the contribution).

      if (!isEfectivo) {
        // NOTE: client-side read-modify-write total (audit C-03) — unchanged here.
        const newTotal = currentCycle.totalCollected + parseFloat(amount);
        const supabaseClient = createClient();
        const { data: updated, error: totalError } = await supabaseClient
          .from('junta_cycles')
          .update({ total_collected: newTotal, updated_at: new Date().toISOString() })
          .eq('id', currentCycle.id)
          .select('id');
        if (totalError || !updated || updated.length === 0) {
          console.error('junta total_collected update failed:', totalError);
          toast.showError(
            'El aporte se registró, pero no se pudo actualizar el total recaudado del ciclo.'
          );
        }
      }

      try {
        await juntaEventsService.create({
          juntaId,
          actorMemberId: myMember.id,
          eventType: 'aporte_registrado',
          description: `${myMember.displayName} registró un aporte de S/ ${parseFloat(amount).toFixed(2)} vía ${activeTab}${isEfectivo ? ' (pendiente de aprobación)' : ''}`,
          metadata: {
            amount: parseFloat(amount),
            method: activeTab,
            status: isEfectivo ? 'pendiente' : 'pagado',
          },
        });
      } catch (eventErr) {
        console.error('junta event log failed:', eventErr);
        toast.showError('El aporte se registró, pero no se pudo agregar al historial de la junta.');
      }

      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError(`Error al registrar el aporte. ${getErrorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FFD43B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (success) {
    const isEfectivo = activeTab === 'efectivo';
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          <div
            className={`w-20 h-20 border-[3px] border-black rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-[4px_4px_0px_rgba(0,0,0,1)] ${isEfectivo ? 'bg-amber-400' : 'bg-[#4ADE80]'}`}
          >
            {isEfectivo ? (
              <AlertTriangle className="w-10 h-10 text-black" strokeWidth={2.5} />
            ) : (
              <CheckCircle className="w-10 h-10 text-black" strokeWidth={2.5} />
            )}
          </div>
          <h2 className="text-2xl font-black text-black mb-2">
            {isEfectivo ? 'Aporte en espera' : '¡Aporte registrado!'}
          </h2>
          <p className="text-gray-500 text-sm font-medium mb-6">
            {isEfectivo
              ? `Tu aporte de S/ ${parseFloat(amount).toFixed(2)} en efectivo está pendiente de aprobación por el receptor.`
              : `Tu aporte de S/ ${parseFloat(amount).toFixed(2)} ha sido registrado correctamente.`}
          </p>
          <button
            onClick={() => router.push(`/finanzas/juntas/${juntaId}`)}
            className="w-full py-4 bg-[#FFD43B] border-[3px] border-black rounded-2xl font-black text-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
          >
            Ver mi junta
          </button>
        </div>
      </div>
    );
  }

  // Find current turn number
  const currentTurnNumber = members.findIndex((m) => m.id === recipientMember?.id) + 1;

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <div className="sticky top-[env(safe-area-inset-top)] z-10 bg-[#FAFAF8] border-b-2 border-black px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border-2 border-black bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-black" strokeWidth={2.5} />
        </button>
        <h1 className="text-lg font-black text-black">Registrar aporte</h1>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        {error && (
          <div className="px-4 py-3 bg-red-50 border-2 border-red-400 rounded-2xl">
            <p className="text-sm font-bold text-red-600">{error}</p>
          </div>
        )}

        {/* Recipient Profile Card */}
        {recipientMember && (
          <div className="bg-black border-[3px] border-black rounded-3xl p-5 shadow-[3px_3px_0px_rgba(0,0,0,1)]">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-3">
              {currentTurnNumber > 0 ? `${currentTurnNumber}er TURNO` : 'TURNO ACTUAL'} — Quien
              recibe el dinero
            </p>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#FFD43B] border-[3px] border-white rounded-full flex items-center justify-center text-2xl font-black text-black shrink-0">
                {recipientMember.displayName[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-xl font-black text-white">{recipientMember.displayName}</p>
                {junta && <p className="text-sm font-bold text-gray-400">{junta.name}</p>}
                {currentCycle && (
                  <p className="text-xs text-gray-500 font-medium">
                    {currentCycle.cycleMonth} {currentCycle.cycleYear}
                  </p>
                )}
              </div>
            </div>

            {/* Amount to receive */}
            {junta && (
              <div className="mt-4 bg-white/10 border border-white/20 rounded-2xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wide">
                    Monto del aporte
                  </p>
                  <p className="text-2xl font-black text-[#FFD43B]">
                    S/ {junta.contributionAmount.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wide">
                    Recibirá
                  </p>
                  <p className="text-lg font-black text-white">
                    S/ {(junta.contributionAmount * junta.maxParticipants).toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="text-xs font-black text-gray-500 uppercase tracking-wide">
            Monto del aporte
          </label>
          <div className="mt-1.5 relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-sm">
              S/
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-10 pr-4 py-4 border-[3px] border-black rounded-2xl text-2xl font-black text-black outline-none focus:border-[#FFD43B] bg-white transition-colors"
            />
          </div>
        </div>

        {/* Payment method tabs */}
        <div>
          <label className="text-xs font-black text-gray-500 uppercase tracking-wide mb-2 block">
            Método de pago
          </label>
          <div className="flex gap-1 bg-gray-100 border-2 border-black rounded-2xl p-1">
            {PAYMENT_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl text-xs font-black transition-all ${
                  activeTab === tab.key
                    ? 'bg-[#FFD43B] text-black border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                <span className="text-base">{tab.emoji}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="mt-3 bg-white border-[3px] border-black rounded-2xl px-4 overflow-hidden">
            {activeTab === 'yape' && (
              <YapePanel
                accounts={recipientAccounts}
                recipientName={recipientMember?.displayName || 'Receptor'}
              />
            )}
            {activeTab === 'plin' && (
              <PlinPanel
                accounts={recipientAccounts}
                recipientName={recipientMember?.displayName || 'Receptor'}
              />
            )}
            {activeTab === 'transferencia' && <TransferenciaPanel accounts={recipientAccounts} />}
            {activeTab === 'efectivo' && <EfectivoPanel />}
          </div>
        </div>

        {/* Receipt / photo — only for non-efectivo */}
        {activeTab !== 'efectivo' && (
          <>
            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-wide">
                Comprobante (opcional)
              </label>
              <div className="mt-1.5 flex gap-3">
                <div className="w-24 h-20 bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center">
                  <Camera className="w-6 h-6 text-gray-400" />
                </div>
                <button className="flex-1 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded-xl py-3 hover:border-black transition-colors">
                  <Camera className="w-5 h-5 text-gray-400" />
                  <span className="text-xs font-bold text-gray-400">Tomar foto</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-wide">
                Nota (opcional)
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Transferencia enviada a las 3pm"
                className="mt-1.5 w-full px-4 py-3 border-[3px] border-black rounded-2xl text-sm font-medium text-black outline-none focus:border-[#FFD43B] bg-white transition-colors"
              />
            </div>
          </>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-[#FFD43B] border-[3px] border-black rounded-2xl font-black text-black text-base shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />{' '}
              Guardando...
            </>
          ) : activeTab === 'efectivo' ? (
            <>
              <Banknote className="w-5 h-5" /> Guardar aporte
            </>
          ) : (
            'Guardar aporte'
          )}
        </button>
      </div>
    </div>
  );
}
