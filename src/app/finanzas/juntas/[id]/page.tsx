'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getErrorMessage } from '@/lib/dataError';
import {
  ArrowLeft,
  MoreHorizontal,
  Calendar,
  CheckCircle,
  AlertCircle,
  Share2,
  Copy,
  MessageCircle,
  ChevronRight,
  Plus,
  Trophy,
  Clock,
} from 'lucide-react';
import {
  juntasService,
  juntaMembersService,
  juntaCyclesService,
  juntaTurnsService,
  juntaContributionsService,
  juntaInvitesService,
  juntaEventsService,
  type Junta,
  type JuntaMember,
  type JuntaCycle,
  type JuntaTurn,
  type JuntaContribution,
  type JuntaEvent,
} from '@/lib/supabaseJuntas';
import { formatMoney, monthNames } from '@/lib/format';

const MONTHS_ES = monthNames('short', { capitalize: true });

function fmtAmount(n: number) {
  return formatMoney(n);
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  activa: { label: 'Activa', color: 'text-green-700', bg: 'bg-green-100', dot: 'bg-green-500' },
  en_pausa: {
    label: 'En pausa',
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    dot: 'bg-orange-500',
  },
  finalizada: {
    label: 'Finalizada',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    dot: 'bg-gray-400',
  },
  pendiente: { label: 'Pendiente', color: 'text-blue-700', bg: 'bg-blue-100', dot: 'bg-blue-500' },
};

type TabKey = 'resumen' | 'aportes' | 'participantes' | 'turnos' | 'actividad';

// ── Countdown Timer ──────────────────────────────────────────────────────────

// `total` is -1 until the first calculation, so "0" always means the draw time has
// really been reached (not "not computed yet").
function useCountdown(targetDateStr: string) {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, total: -1 });

  useEffect(() => {
    function calc() {
      // Try parsing as full ISO datetime first, then as date-only
      let target: Date;
      if (targetDateStr && targetDateStr.includes('T')) {
        target = new Date(targetDateStr);
      } else if (targetDateStr) {
        target = new Date(targetDateStr + 'T00:00:00');
      } else {
        setTimeLeft({ h: 0, m: 0, s: 0, total: 0 });
        return;
      }
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ h: 0, m: 0, s: 0, total: 0 });
        return;
      }
      const totalSecs = Math.floor(diff / 1000);
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;
      setTimeLeft({ h, m, s, total: diff });
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [targetDateStr]);

  return timeLeft;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function CountdownTimer({ junta, onZero }: { junta: Junta; onZero?: () => void }) {
  const router = useRouter();
  const { h, m, s, total } = useCountdown(junta.firstDrawDate);
  const [pulse, setPulse] = useState(false);
  const [triggered, setTriggered] = useState(false);
  // Last value seen while the page is open: only a live transition (> 0 → 0) opens the
  // draw automatically. If the draw time had already passed when the page was opened,
  // the user stays on the profile and can open the draw from the card.
  const prevTotal = useRef(-1);

  useEffect(() => {
    const id = setInterval(() => setPulse((p) => !p), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const prev = prevTotal.current;
    prevTotal.current = total;
    if (total === 0 && prev > 0 && !triggered && junta.firstDrawDate) {
      setTriggered(true);
      onZero?.();
    }
  }, [total, triggered, junta.firstDrawDate, onZero]);

  if (total < 0) return null;

  const isExpired = total === 0;
  const isUrgent = total > 0 && total < 3600000; // less than 1 hour

  if (isExpired) {
    return (
      <button
        onClick={() => router.push(`/finanzas/juntas/${junta.id}/sorteo`)}
        className="w-full bg-black border-[3px] border-black rounded-3xl p-5 shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all text-left"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-[#FFD43B] border-[3px] border-white rounded-2xl flex items-center justify-center text-xl shrink-0 animate-bounce">
            🎰
          </div>
          <div>
            <p className="font-black text-white text-sm">¡Es hora del sorteo!</p>
            <p className="text-xs text-gray-400 font-medium">Toca para ver el sorteo en vivo</p>
          </div>
        </div>
        <div className="bg-[#FFD43B] rounded-2xl px-4 py-2 text-center">
          <p className="font-black text-black text-sm">Ver sorteo →</p>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => router.push(`/finanzas/juntas/${junta.id}/sorteo`)}
      className={`w-full border-[3px] border-black rounded-3xl p-5 shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all text-left ${
        isUrgent ? 'bg-[#FFF3CD]' : 'bg-black'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Clock className={`w-4 h-4 ${isUrgent ? 'text-orange-600' : 'text-gray-400'}`} />
        <p
          className={`text-xs font-black uppercase tracking-wide ${isUrgent ? 'text-orange-600' : 'text-gray-400'}`}
        >
          El sorteo de turnos empieza en
        </p>
      </div>

      {/* Big animated countdown */}
      <div className="flex items-center justify-center gap-2 mb-3">
        {/* Hours */}
        <div
          className={`flex flex-col items-center px-3 py-2 rounded-2xl border-[3px] border-white/20 min-w-[64px] transition-all ${
            isUrgent ? 'bg-orange-500 border-orange-300' : 'bg-white/10'
          }`}
        >
          <span
            className={`text-3xl font-black tabular-nums leading-none ${isUrgent ? 'text-white' : 'text-white'} ${pulse ? 'scale-105' : 'scale-100'} transition-transform`}
          >
            {pad(h)}
          </span>
          <span
            className={`text-[10px] font-bold mt-0.5 ${isUrgent ? 'text-white/80' : 'text-gray-400'}`}
          >
            HRS
          </span>
        </div>

        <span
          className={`text-3xl font-black ${pulse ? 'opacity-100' : 'opacity-30'} transition-opacity ${isUrgent ? 'text-orange-600' : 'text-white'}`}
        >
          :
        </span>

        {/* Minutes */}
        <div
          className={`flex flex-col items-center px-3 py-2 rounded-2xl border-[3px] border-white/20 min-w-[64px] transition-all ${
            isUrgent ? 'bg-orange-500 border-orange-300' : 'bg-white/10'
          }`}
        >
          <span
            className={`text-3xl font-black tabular-nums leading-none text-white ${pulse ? 'scale-105' : 'scale-100'} transition-transform`}
          >
            {pad(m)}
          </span>
          <span
            className={`text-[10px] font-bold mt-0.5 ${isUrgent ? 'text-white/80' : 'text-gray-400'}`}
          >
            MIN
          </span>
        </div>

        <span
          className={`text-3xl font-black ${pulse ? 'opacity-100' : 'opacity-30'} transition-opacity ${isUrgent ? 'text-orange-600' : 'text-white'}`}
        >
          :
        </span>

        {/* Seconds */}
        <div
          className={`flex flex-col items-center px-3 py-2 rounded-2xl border-[3px] min-w-[64px] transition-all ${
            isUrgent ? 'bg-red-500 border-red-300 animate-pulse' : 'bg-[#FFD43B] border-[#FFD43B]'
          }`}
        >
          <span
            className={`text-3xl font-black tabular-nums leading-none ${isUrgent ? 'text-white' : 'text-black'}`}
          >
            {pad(s)}
          </span>
          <span
            className={`text-[10px] font-bold mt-0.5 ${isUrgent ? 'text-white/80' : 'text-black/60'}`}
          >
            SEG
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
        <p className={`text-xs font-bold ${isUrgent ? 'text-orange-700' : 'text-gray-400'}`}>
          Toca para ver el sorteo en vivo
        </p>
      </div>
    </button>
  );
}

// ── Resumen Tab ──────────────────────────────────────────────────────────────

function ResumenTab({
  junta,
  members,
  cycle,
  turns,
  myMember,
}: {
  junta: Junta;
  members: JuntaMember[];
  cycle: JuntaCycle | null;
  turns: JuntaTurn[];
  myMember: JuntaMember | null;
}) {
  const router = useRouter();
  const progress = cycle ? cycle.totalCollected / Math.max(cycle.totalExpected, 1) : 0;
  const myTurn = turns.find((t) => t.memberId === myMember?.id);
  const st = STATUS_CONFIG[junta.status] || STATUS_CONFIG.pendiente;

  const handleCountdownZero = useCallback(() => {
    // Auto-navigate to sorteo when countdown hits 0
    router.push(`/finanzas/juntas/${junta.id}/sorteo?auto=1`);
  }, [router, junta.id]);

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className="bg-white border-[3px] border-black rounded-3xl p-5 shadow-[3px_3px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-black text-black">{junta.name}</h2>
            <p className="text-sm text-gray-500 font-medium">
              {members.length} participantes · {formatMoney(junta.contributionAmount)} mensual
            </p>
          </div>
          <span
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black border-2 border-current ${st.color} ${st.bg}`}
          >
            <span className={`w-2 h-2 rounded-full ${st.dot}`} />
            {st.label}
          </span>
        </div>

        {/* Next contribution */}
        <div className="bg-[#F0F7FF] border-2 border-[#93C5FD] rounded-2xl p-4 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-black text-blue-600 uppercase tracking-wide">
              Próximo aporte
            </span>
          </div>
          <p className="text-2xl font-black text-black">{fmtAmount(junta.contributionAmount)}</p>
          <p className="text-sm font-bold text-gray-500">{junta.firstDrawDate}</p>
        </div>

        <button
          onClick={() => router.push(`/finanzas/juntas/${junta.id}/aporte`)}
          className="w-full py-3.5 bg-[#FFD43B] border-[3px] border-black rounded-2xl font-black text-black text-sm shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all flex items-center justify-center gap-2"
        >
          Registrar aporte →
        </button>
      </div>

      {/* My turn */}
      {myTurn && (
        <div className="bg-[#F5F0FF] border-[3px] border-[#7C3AED] rounded-3xl p-5 shadow-[3px_3px_0px_rgba(124,58,237,0.3)]">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-[#7C3AED]" />
            <span className="text-xs font-black text-[#7C3AED] uppercase tracking-wide">
              Tu turno
            </span>
          </div>
          <p className="text-xl font-black text-black">
            {myTurn.turnMonth} {myTurn.turnYear}
          </p>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Recibirás {fmtAmount(myTurn.amountToReceive)}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs font-bold text-green-600">
              Vas al día · {members.length} de {junta.maxParticipants} aportes
            </span>
          </div>
        </div>
      )}

      {/* Progress */}
      {cycle && (
        <div className="bg-white border-[3px] border-black rounded-3xl p-5 shadow-[3px_3px_0px_rgba(0,0,0,1)]">
          <h3 className="font-black text-black mb-3">Progreso de esta ronda</h3>
          <div className="flex items-center justify-between mb-2">
            <span className="text-lg font-black text-black">{fmtAmount(cycle.totalCollected)}</span>
            <span className="text-sm font-bold text-gray-500">
              / {fmtAmount(cycle.totalExpected)}
            </span>
          </div>
          <div className="h-4 bg-gray-100 border-2 border-black rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-[#4ADE80] rounded-full transition-all duration-700"
              style={{ width: `${Math.min(progress * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs font-bold text-gray-500">
            Falta {junta.maxParticipants - Math.round(progress * junta.maxParticipants)} aporte
            {junta.maxParticipants - Math.round(progress * junta.maxParticipants) !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Countdown Timer / Sorteo CTA */}
      {junta.firstDrawDate ? (
        <CountdownTimer junta={junta} onZero={handleCountdownZero} />
      ) : (
        <Link
          href={`/finanzas/juntas/${junta.id}/sorteo`}
          className="flex items-center gap-3 bg-black border-[3px] border-black rounded-3xl p-5 shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
        >
          <div className="w-12 h-12 bg-[#FFD43B] border-[3px] border-white rounded-2xl flex items-center justify-center text-2xl shrink-0">
            🎰
          </div>
          <div className="flex-1">
            <p className="font-black text-white text-base">Sorteo mensual</p>
            <p className="text-xs text-gray-400 font-medium">
              Gira la ruleta para definir el turno
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>
      )}
    </div>
  );
}

// ── Aportes Tab ──────────────────────────────────────────────────────────────

function AportesTab({
  junta,
  members,
  cycle,
  contributions,
}: {
  junta: Junta;
  members: JuntaMember[];
  cycle: JuntaCycle | null;
  contributions: JuntaContribution[];
}) {
  const router = useRouter();
  const progress = cycle ? cycle.totalCollected / Math.max(cycle.totalExpected, 1) : 0;

  return (
    <div className="space-y-4">
      {cycle && (
        <div className="bg-white border-[3px] border-black rounded-3xl p-5 shadow-[3px_3px_0px_rgba(0,0,0,1)]">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-1">
            {cycle.cycleMonth.toUpperCase()} {cycle.cycleYear}
          </p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-black text-black">
              {fmtAmount(cycle.totalCollected)}
            </span>
            <span className="text-sm font-bold text-gray-500">
              / {fmtAmount(cycle.totalExpected)}
            </span>
          </div>
          <div className="h-4 bg-gray-100 border-2 border-black rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-[#4ADE80] rounded-full transition-all duration-700"
              style={{ width: `${Math.min(progress * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs font-bold text-gray-500">
            {contributions.filter((c) => c.status === 'pagado' || c.status === 'verificado').length}{' '}
            de {members.length} aportes
          </p>
        </div>
      )}

      <div className="bg-white border-[3px] border-black rounded-3xl overflow-hidden shadow-[3px_3px_0px_rgba(0,0,0,1)]">
        {members.map((m, i) => {
          const contrib = contributions.find((c) => c.memberId === m.id);
          const paid = contrib?.status === 'pagado' || contrib?.status === 'verificado';
          return (
            <div
              key={m.id}
              className={`flex items-center gap-3 px-5 py-4 ${i < members.length - 1 ? 'border-b-2 border-gray-100' : ''}`}
            >
              <div className="w-9 h-9 rounded-full bg-[#FFD43B] border-2 border-black flex items-center justify-center text-sm font-black text-black shrink-0">
                {m.displayName[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-black text-sm truncate">
                  {m.displayName}
                  {m.role === 'admin' ? ' (Tú)' : ''}
                </p>
                {contrib?.paidAt && <p className="text-xs text-gray-400 font-medium">Pagado</p>}
              </div>
              {paid ? (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-black border border-green-300">
                  <CheckCircle className="w-3 h-3" /> Pagado
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-black border border-orange-300">
                  <AlertCircle className="w-3 h-3" /> Pendiente
                </span>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => router.push(`/finanzas/juntas/${junta.id}/aporte`)}
        className="w-full py-4 bg-[#FFD43B] border-[3px] border-black rounded-2xl font-black text-black text-base shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" strokeWidth={3} /> Registrar aporte
      </button>
    </div>
  );
}

// ── Participantes Tab ────────────────────────────────────────────────────────

function ParticipantesTab({
  junta,
  members,
  turns,
  inviteCode,
}: {
  junta: Junta;
  members: JuntaMember[];
  turns: JuntaTurn[];
  inviteCode: string;
}) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `https://moneo.app/junta/${inviteCode}`;

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWhatsApp() {
    const msg = encodeURIComponent(`¡Únete a mi junta en MONEO! ${inviteUrl}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  const memberTurns = (memberId: string) => turns.find((t) => t.memberId === memberId);

  return (
    <div className="space-y-4">
      {/* Invite card */}
      <div className="bg-[#FFD43B] border-[3px] border-black rounded-3xl p-5 shadow-[3px_3px_0px_rgba(0,0,0,1)]">
        <h3 className="font-black text-black text-base mb-1">Invita a tu junta</h3>
        <p className="text-xs text-black/70 font-medium mb-3">
          Invita a {Math.max(0, junta.maxParticipants - members.length)} personas más para completar
          la junta.
        </p>
        <div className="bg-white border-2 border-black rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
          <span className="text-xs font-bold text-gray-600 flex-1 truncate">{inviteUrl}</span>
          <button
            onClick={handleCopy}
            className="shrink-0 px-2 py-1 bg-black text-white text-xs font-black rounded-lg"
          >
            {copied ? '✓' : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleWhatsApp}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366] border-2 border-black rounded-xl text-white font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none transition-all"
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </button>
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border-2 border-black rounded-xl text-black font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none transition-all"
          >
            <Copy className="w-4 h-4" /> Copiar
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border-2 border-black rounded-xl text-black font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none transition-all">
            <Share2 className="w-4 h-4" /> Compartir
          </button>
        </div>
      </div>

      {/* Members list */}
      <div className="bg-white border-[3px] border-black rounded-3xl overflow-hidden shadow-[3px_3px_0px_rgba(0,0,0,1)]">
        {members.map((m, i) => {
          const turn = memberTurns(m.id);
          return (
            <div
              key={m.id}
              className={`flex items-center gap-3 px-5 py-4 ${i < members.length - 1 ? 'border-b-2 border-gray-100' : ''}`}
            >
              <div className="w-10 h-10 rounded-full bg-[#FFD43B] border-2 border-black flex items-center justify-center text-sm font-black text-black shrink-0">
                {m.displayName[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-black text-sm">
                  {m.displayName}
                  {m.role === 'admin' ? ' (Tú)' : ''}
                </p>
                {turn && (
                  <p className="text-xs text-gray-400 font-medium">
                    Turno: {turn.turnMonth} {turn.turnYear}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                {m.role === 'admin' && (
                  <span className="px-2 py-0.5 bg-black text-white text-[10px] font-black rounded-full">
                    Admin
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    m.status === 'unido'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {m.status === 'unido' ? '✓ Unido' : 'Pendiente'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Turnos Tab ───────────────────────────────────────────────────────────────

function TurnosTab({
  turns,
  members,
  myMember,
}: {
  turns: JuntaTurn[];
  members: JuntaMember[];
  myMember: JuntaMember | null;
}) {
  const getMember = (id: string) => members.find((m) => m.id === id);

  return (
    <div className="space-y-3">
      {turns.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 border-2 border-black rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl">
            🎰
          </div>
          <p className="font-black text-black mb-1">Aún no hay turnos</p>
          <p className="text-sm text-gray-500">Realiza el sorteo para definir el orden.</p>
        </div>
      )}
      {turns.map((turn, i) => {
        const member = getMember(turn.memberId);
        const isMe = turn.memberId === myMember?.id;
        return (
          <div
            key={turn.id}
            className={`flex items-center gap-4 px-5 py-4 rounded-2xl border-[3px] transition-all ${
              isMe
                ? 'bg-[#F5F0FF] border-[#7C3AED] shadow-[3px_3px_0px_rgba(124,58,237,0.3)]'
                : 'bg-white border-black shadow-[2px_2px_0px_rgba(0,0,0,0.5)]'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-full border-[3px] border-black flex items-center justify-center text-sm font-black shrink-0 ${
                i === 0 ? 'bg-[#FFD43B]' : isMe ? 'bg-[#7C3AED] text-white' : 'bg-gray-100'
              }`}
            >
              {turn.turnOrder}
            </div>
            <div className="w-9 h-9 rounded-full bg-[#FFD43B] border-2 border-black flex items-center justify-center text-sm font-black text-black shrink-0">
              {member?.displayName[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-black text-sm">{member?.displayName || '—'}</p>
              <p className="text-xs text-gray-500 font-medium">
                {turn.turnMonth} {turn.turnYear}
              </p>
            </div>
            <div className="text-right">
              <p className="font-black text-black text-sm">{fmtAmount(turn.amountToReceive)}</p>
              {isMe && <span className="text-[10px] font-black text-[#7C3AED]">Tu turno</span>}
              {i === 0 && !isMe && (
                <span className="text-[10px] font-black text-[#FFD43B] bg-black px-1.5 py-0.5 rounded-full">
                  Recibe
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Actividad Tab ────────────────────────────────────────────────────────────

function ActividadTab({ events, members }: { events: JuntaEvent[]; members: JuntaMember[] }) {
  const getMember = (id: string | null) => (id ? members.find((m) => m.id === id) : null);

  const EVENT_ICONS: Record<string, string> = {
    junta_creada: '🎉',
    aporte_registrado: '💰',
    sorteo_realizado: '🎰',
    miembro_unido: '👋',
    default: '📋',
  };

  return (
    <div className="space-y-3">
      {events.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 border-2 border-black rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl">
            📋
          </div>
          <p className="font-black text-black mb-1">Sin actividad aún</p>
          <p className="text-sm text-gray-500">Las acciones de la junta aparecerán aquí.</p>
        </div>
      )}
      {events.map((ev) => {
        const actor = getMember(ev.actorMemberId);
        const icon = EVENT_ICONS[ev.eventType] || EVENT_ICONS.default;
        const date = new Date(ev.createdAt);
        const dateStr = `${date.getDate()} ${MONTHS_ES[date.getMonth()]}`;
        return (
          <div
            key={ev.id}
            className="flex items-start gap-3 bg-white border-2 border-gray-100 rounded-2xl px-4 py-3"
          >
            <div className="w-9 h-9 bg-[#FAFAF8] border-2 border-black rounded-xl flex items-center justify-center text-lg shrink-0">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-black leading-snug">{ev.description}</p>
              {actor && <p className="text-xs text-gray-400 font-medium">{actor.displayName}</p>}
            </div>
            <span className="text-xs text-gray-400 font-medium shrink-0">{dateStr}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Detail Page ─────────────────────────────────────────────────────────

export default function JuntaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const juntaId = params.id as string;
  const isNewlyCreated = searchParams.get('created') === '1';

  const [tab, setTab] = useState<TabKey>('resumen');
  const [junta, setJunta] = useState<Junta | null>(null);
  const [members, setMembers] = useState<JuntaMember[]>([]);
  const [cycles, setCycles] = useState<JuntaCycle[]>([]);
  const [turns, setTurns] = useState<JuntaTurn[]>([]);
  const [contributions, setContributions] = useState<JuntaContribution[]>([]);
  const [events, setEvents] = useState<JuntaEvent[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [showCreatedBanner, setShowCreatedBanner] = useState(isNewlyCreated);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setNotFound(false);
      const [j, m, c, t, ev, inv] = await Promise.all([
        juntasService.getById(juntaId),
        juntaMembersService.getByJunta(juntaId),
        juntaCyclesService.getByJunta(juntaId),
        juntaTurnsService.getByJunta(juntaId),
        juntaEventsService.getByJunta(juntaId),
        juntaInvitesService.getByJunta(juntaId),
      ]);
      // getById resolves null only when the junta really doesn't exist / isn't visible.
      if (!j) {
        setNotFound(true);
        return;
      }
      setJunta(j);
      setMembers(m);
      setCycles(c);
      setTurns(t);
      setEvents(ev);
      if (inv.length > 0) setInviteCode(inv[0].inviteCode);

      // Load contributions for current cycle
      const currentCycle = c.find((cy) => cy.status === 'activo') || c[c.length - 1];
      if (currentCycle) {
        const contribs = await juntaContributionsService.getByCycle(currentCycle.id);
        setContributions(contribs);
      }
    } catch (err) {
      console.error(err);
      setError(`Error al cargar la junta. ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }, [juntaId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (showCreatedBanner) {
      const t = setTimeout(() => setShowCreatedBanner(false), 4000);
      return () => clearTimeout(t);
    }
  }, [showCreatedBanner]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#FFD43B] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-bold text-gray-500">Cargando junta...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
        <div role="alert" className="text-center">
          <p className="text-lg font-black text-black mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={loadData}
              className="px-4 py-2 bg-white border-2 border-black rounded-xl font-bold text-sm"
            >
              Reintentar
            </button>
            <button
              onClick={() => router.push('/finanzas/juntas')}
              className="px-4 py-2 bg-[#FFD43B] border-2 border-black rounded-xl font-bold text-sm"
            >
              Volver a Juntas
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !junta) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg font-black text-black mb-2">Junta no encontrada</p>
          <button
            onClick={() => router.push('/finanzas/juntas')}
            className="px-4 py-2 bg-[#FFD43B] border-2 border-black rounded-xl font-bold text-sm"
          >
            Volver a Juntas
          </button>
        </div>
      </div>
    );
  }

  const currentCycle =
    cycles.find((c) => c.status === 'activo') || cycles[cycles.length - 1] || null;
  const myMember = members.find((m) => m.role === 'admin') || members[0] || null;
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'aportes', label: 'Aportes' },
    { key: 'participantes', label: 'Participantes' },
    { key: 'turnos', label: 'Turnos' },
    { key: 'actividad', label: 'Actividad' },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Created banner */}
      {showCreatedBanner && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-[#4ADE80] border-[3px] border-black rounded-2xl px-4 py-3 shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center gap-3">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="font-black text-black text-sm">¡Junta creada!</p>
            <p className="text-xs text-black/70 font-medium">Todo listo para empezar.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-[env(safe-area-inset-top)] z-10 bg-[#FAFAF8] border-b-2 border-black px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.push('/finanzas/juntas')}
          className="w-9 h-9 rounded-xl border-2 border-black bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-black" strokeWidth={2.5} />
        </button>
        <h1 className="text-lg font-black text-black flex-1 truncate">{junta.name}</h1>
        <button className="w-9 h-9 rounded-xl border-2 border-black bg-white flex items-center justify-center hover:bg-gray-50 transition-colors">
          <MoreHorizontal className="w-4 h-4 text-black" strokeWidth={2.5} />
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b-2 border-black bg-white overflow-x-auto">
        <div className="flex min-w-max px-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-black border-b-[3px] transition-all whitespace-nowrap ${
                tab === t.key
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-400 hover:text-black'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 py-5 max-w-2xl mx-auto">
        {tab === 'resumen' && (
          <ResumenTab
            junta={junta}
            members={members}
            cycle={currentCycle}
            turns={turns}
            myMember={myMember}
          />
        )}
        {tab === 'aportes' && (
          <AportesTab
            junta={junta}
            members={members}
            cycle={currentCycle}
            contributions={contributions}
          />
        )}
        {tab === 'participantes' && (
          <ParticipantesTab junta={junta} members={members} turns={turns} inviteCode={inviteCode} />
        )}
        {tab === 'turnos' && <TurnosTab turns={turns} members={members} myMember={myMember} />}
        {tab === 'actividad' && <ActividadTab events={events} members={members} />}
      </div>
    </div>
  );
}
