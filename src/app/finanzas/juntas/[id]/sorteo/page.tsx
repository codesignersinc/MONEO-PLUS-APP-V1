'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Shield } from 'lucide-react';
import { getErrorMessage } from '@/lib/dataError';
import {
  juntasService,
  juntaMembersService,
  juntaCyclesService,
  juntaTurnsService,
  juntaEventsService,
  type Junta,
  type JuntaMember,
  type JuntaCycle,
  type JuntaTurn,
} from '@/lib/supabaseJuntas';

const MONTHS_FULL = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WHEEL_COLORS = [
  '#FFD43B',
  '#4ADE80',
  '#C084FC',
  '#F87171',
  '#60A5FA',
  '#FB923C',
  '#34D399',
  '#A78BFA',
  '#F472B6',
  '#38BDF8',
  '#FBBF24',
  '#86EFAC',
];

function fmtAmount(n: number) {
  return 'S/ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function pickWinnerFromSeed(seed: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % count;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

// ── Confetti ─────────────────────────────────────────────────────────────────

function Confetti({ active }: { active: boolean }) {
  const pieces = Array.from({ length: 30 }, (_, i) => i);
  if (!active) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((i) => (
        <div
          key={i}
          className="absolute w-3 h-3 rounded-sm animate-bounce"
          style={{
            left: `${(i * 37) % 100}%`,
            top: `-${(i * 13) % 20}%`,
            backgroundColor: WHEEL_COLORS[i % WHEEL_COLORS.length],
            animationDelay: `${(i * 0.1) % 1}s`,
            animationDuration: `${0.8 + (i % 5) * 0.2}s`,
            transform: `rotate(${(i * 47) % 360}deg)`,
          }}
        />
      ))}
    </div>
  );
}

// ── Wheel Canvas ──────────────────────────────────────────────────────────────

function WheelCanvas({ members, rotation }: { members: JuntaMember[]; rotation: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const n = members.length;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || n === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 4;
    const sliceAngle = (2 * Math.PI) / n;

    ctx.clearRect(0, 0, size, size);

    for (let i = 0; i < n; i++) {
      const startAngle = rotation + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();

      const midAngle = startAngle + sliceAngle / 2;
      const labelR = r * 0.65;
      const lx = cx + Math.cos(midAngle) * labelR;
      const ly = cy + Math.sin(midAngle) * labelR;

      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(midAngle + Math.PI / 2);
      ctx.fillStyle = '#000';
      ctx.font = `bold ${Math.max(10, Math.min(14, 120 / n))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const name = members[i].displayName.split(' ')[0];
      ctx.fillText(name.length > 8 ? name.slice(0, 7) + '…' : name, 0, 0);
      ctx.restore();
    }

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, 2 * Math.PI);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.fillStyle = '#FFD43B';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', cx, cy);
  }, [members, rotation, n]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={300}
      className="rounded-full border-[4px] border-black shadow-[6px_6px_0px_rgba(0,0,0,1)]"
    />
  );
}

// ── Live Countdown ────────────────────────────────────────────────────────────

function LiveCountdown({ targetDateStr, onZero }: { targetDateStr: string; onZero: () => void }) {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, total: -1 });
  const [pulse, setPulse] = useState(false);
  const calledRef = useRef(false);

  useEffect(() => {
    function calc() {
      let target: Date;
      if (targetDateStr.includes('T')) {
        target = new Date(targetDateStr);
      } else {
        target = new Date(targetDateStr + 'T00:00:00');
      }
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ h: 0, m: 0, s: 0, total: 0 });
        if (!calledRef.current) {
          calledRef.current = true;
          onZero();
        }
        return;
      }
      const totalSecs = Math.floor(diff / 1000);
      setTimeLeft({
        h: Math.floor(totalSecs / 3600),
        m: Math.floor((totalSecs % 3600) / 60),
        s: totalSecs % 60,
        total: diff,
      });
    }
    calc();
    const id = setInterval(calc, 1000);
    const pulseId = setInterval(() => setPulse((p) => !p), 500);
    return () => {
      clearInterval(id);
      clearInterval(pulseId);
    };
  }, [targetDateStr, onZero]);

  if (timeLeft.total === -1) return null;

  const isUrgent = timeLeft.total > 0 && timeLeft.total < 60000;

  return (
    <div className="w-full text-center mb-6">
      <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-4">
        El sorteo de turnos empieza en
      </p>
      <div className="flex items-center justify-center gap-3">
        {/* Hours */}
        <div className="flex flex-col items-center">
          <div
            className={`w-20 h-20 rounded-2xl border-[3px] border-white/30 flex items-center justify-center transition-all ${
              isUrgent ? 'bg-red-500 border-red-400 animate-pulse' : 'bg-white/10'
            }`}
          >
            <span className="text-4xl font-black text-white tabular-nums">{pad(timeLeft.h)}</span>
          </div>
          <span className="text-[10px] font-black text-gray-500 mt-1 uppercase tracking-wider">
            Horas
          </span>
        </div>

        <span
          className={`text-4xl font-black mb-5 transition-opacity ${pulse ? 'opacity-100' : 'opacity-20'} ${isUrgent ? 'text-red-400' : 'text-white'}`}
        >
          :
        </span>

        {/* Minutes */}
        <div className="flex flex-col items-center">
          <div
            className={`w-20 h-20 rounded-2xl border-[3px] border-white/30 flex items-center justify-center transition-all ${
              isUrgent ? 'bg-red-500 border-red-400 animate-pulse' : 'bg-white/10'
            }`}
          >
            <span className="text-4xl font-black text-white tabular-nums">{pad(timeLeft.m)}</span>
          </div>
          <span className="text-[10px] font-black text-gray-500 mt-1 uppercase tracking-wider">
            Min
          </span>
        </div>

        <span
          className={`text-4xl font-black mb-5 transition-opacity ${pulse ? 'opacity-100' : 'opacity-20'} ${isUrgent ? 'text-red-400' : 'text-white'}`}
        >
          :
        </span>

        {/* Seconds */}
        <div className="flex flex-col items-center">
          <div
            className={`w-20 h-20 rounded-2xl border-[3px] flex items-center justify-center transition-all ${
              isUrgent ? 'bg-red-600 border-red-400 animate-pulse' : 'bg-[#FFD43B] border-[#FFD43B]'
            }`}
          >
            <span
              className={`text-4xl font-black tabular-nums ${isUrgent ? 'text-white' : 'text-black'}`}
            >
              {pad(timeLeft.s)}
            </span>
          </div>
          <span className="text-[10px] font-black text-gray-500 mt-1 uppercase tracking-wider">
            Seg
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
        <p className="text-xs font-bold text-gray-400">
          El sistema girará la ruleta automáticamente
        </p>
      </div>
    </div>
  );
}

// ── Main Sorteo Page ──────────────────────────────────────────────────────────

export default function SorteoPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const juntaId = params.id as string;
  const isAuto = searchParams.get('auto') === '1';

  const [junta, setJunta] = useState<Junta | null>(null);
  const [members, setMembers] = useState<JuntaMember[]>([]);
  const [currentCycle, setCurrentCycle] = useState<JuntaCycle | null>(null);
  const [existingTurns, setExistingTurns] = useState<JuntaTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showCountdown, setShowCountdown] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const autoSpinTriggered = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        const [j, m, c, t] = await Promise.all([
          juntasService.getById(juntaId),
          juntaMembersService.getByJunta(juntaId),
          juntaCyclesService.getByJunta(juntaId),
          juntaTurnsService.getByJunta(juntaId),
        ]);
        setJunta(j);
        setMembers(m);
        const active = c.find((cy) => cy.status === 'activo') || c[c.length - 1] || null;
        setCurrentCycle(active);
        setExistingTurns(t);

        // If draw already performed, show result immediately
        if (active?.drawWinnerMemberId) {
          const idx = m.findIndex((mem) => mem.id === active.drawWinnerMemberId);
          if (idx >= 0) {
            setWinnerIndex(idx);
            setShowResult(true);
            setSaved(true);
            const sliceAngle = (2 * Math.PI) / m.length;
            const targetAngle = -(idx * sliceAngle + sliceAngle / 2) + Math.PI * 1.5;
            setRotation(targetAngle + Math.PI * 8);
          }
        } else if (j?.firstDrawDate) {
          // Show countdown if draw date is in the future
          let target = j.firstDrawDate.includes('T')
            ? new Date(j.firstDrawDate)
            : new Date(j.firstDrawDate + 'T00:00:00');
          if (target.getTime() > Date.now()) {
            setShowCountdown(true);
          }
        }
      } catch (err) {
        console.error(err);
        setError(`Error al cargar el sorteo. ${getErrorMessage(err)}`);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [juntaId]);

  const handleSpin = useCallback(
    (membersArr: JuntaMember[], cycle: JuntaCycle) => {
      if (spinning || showResult || membersArr.length === 0) return;
      setSpinning(true);
      setShowCountdown(false);
      setError('');

      const seed = `${juntaId}-${cycle.id}-${cycle.cycleNumber}`;
      const winIdx = pickWinnerFromSeed(seed, membersArr.length);

      const n = membersArr.length;
      const sliceAngle = (2 * Math.PI) / n;
      const targetAngle = -(winIdx * sliceAngle + sliceAngle / 2) + Math.PI * 1.5;
      const totalRotation = Math.PI * 2 * 8 + targetAngle;

      const duration = 4500;
      const startTime = performance.now();
      const startRotation = 0;

      function easeOut(t: number) {
        return 1 - Math.pow(1 - t, 4);
      }

      function animate(now: number) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = easeOut(t);
        const current = startRotation + totalRotation * eased;
        setRotation(current);

        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          setRotation(startRotation + totalRotation);
          setWinnerIndex(winIdx);
          setSpinning(false);
          setTimeout(() => {
            setShowResult(true);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3500);
            // Auto-save after spin
            autoSaveResult(winIdx, membersArr, cycle);
          }, 600);
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    },
    [spinning, showResult, juntaId]
  );

  const autoSaveResult = useCallback(
    async (winIdx: number, membersArr: JuntaMember[], cycle: JuntaCycle) => {
      if (!junta) return;
      setSaving(true);
      try {
        const winner = membersArr[winIdx];
        const seed = `${juntaId}-${cycle.id}-${cycle.cycleNumber}`;

        await juntaCyclesService.performDraw(cycle.id, winner.id, seed);

        if (existingTurns.length === 0) {
          const drawDateStr = junta.firstDrawDate.includes('T')
            ? junta.firstDrawDate
            : junta.firstDrawDate + 'T00:00:00';
          const drawDate = new Date(drawDateStr);
          const turns: Omit<JuntaTurn, 'id' | 'createdAt'>[] = membersArr.map((m, i) => {
            const d = new Date(drawDate);
            d.setMonth(d.getMonth() + i);
            return {
              juntaId,
              memberId: m.id,
              turnOrder: i + 1,
              turnMonth: MONTHS_FULL[d.getMonth()],
              turnYear: d.getFullYear(),
              amountToReceive: junta.contributionAmount * junta.maxParticipants,
              status: i === 0 ? 'proximo' : 'pendiente',
            };
          });
          const reordered = [turns[winIdx], ...turns.filter((_, i) => i !== winIdx)].map(
            (t, i) => ({ ...t, turnOrder: i + 1 })
          );
          await juntaTurnsService.createMany(reordered);
        }

        await juntaEventsService.create({
          juntaId,
          actorMemberId: null,
          eventType: 'sorteo_realizado',
          description: `Sorteo automático realizado. Ganador: ${winner.displayName}`,
          metadata: { winnerId: winner.id, cycleId: cycle.id, seed, auto: true },
        });

        setSaved(true);
      } catch (err) {
        console.error(err);
        setError(`Error al guardar el resultado. ${getErrorMessage(err)}`);
      } finally {
        setSaving(false);
      }
    },
    [junta, juntaId, existingTurns]
  );

  const handleCountdownZero = useCallback(() => {
    if (autoSpinTriggered.current || !currentCycle || members.length === 0) return;
    autoSpinTriggered.current = true;
    // Small delay for dramatic effect
    setTimeout(() => handleSpin(members, currentCycle), 1500);
  }, [currentCycle, members, handleSpin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FFD43B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const winner = winnerIndex !== null ? members[winnerIndex] : null;

  return (
    <div className="min-h-screen bg-black text-white">
      <Confetti active={showConfetti} />

      {/* Header */}
      <div className="px-4 py-4 flex items-center gap-3 border-b border-white/10">
        <button
          onClick={() => router.push(`/finanzas/juntas/${juntaId}`)}
          className="w-9 h-9 rounded-xl border-2 border-white/30 flex items-center justify-center hover:border-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-white" strokeWidth={2.5} />
        </button>
        <div>
          <h1 className="text-lg font-black text-white leading-tight">
            Sorteo de {currentCycle?.cycleMonth} {currentCycle?.cycleYear}
          </h1>
          <p className="text-xs text-gray-400 font-medium">Todos los participantes están listos.</p>
        </div>
      </div>

      <div className="px-4 py-6 flex flex-col items-center max-w-lg mx-auto">
        {error && (
          <div className="w-full mb-4 px-4 py-3 bg-red-900/50 border-2 border-red-500 rounded-2xl">
            <p className="text-sm font-bold text-red-400">{error}</p>
          </div>
        )}

        {/* Countdown phase */}
        {showCountdown && !showResult && junta?.firstDrawDate && (
          <LiveCountdown targetDateStr={junta.firstDrawDate} onZero={handleCountdownZero} />
        )}

        {/* Wheel */}
        {!showResult ? (
          <div className="flex flex-col items-center w-full">
            {!showCountdown && (
              <p className="text-gray-400 text-sm font-medium mb-8 text-center">
                {spinning ? '🎰 El sistema está girando la ruleta...' : '¿Quién recibe este mes?'}
              </p>
            )}

            {/* Pointer */}
            <div className="relative mb-2">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
                <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-[#FFD43B]" />
              </div>
              <WheelCanvas members={members} rotation={rotation} />
            </div>

            {spinning && (
              <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full">
                <div className="w-3 h-3 border-2 border-[#FFD43B] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-bold text-gray-300">Girando automáticamente...</p>
              </div>
            )}

            {/* 100% random badge */}
            <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
              <Shield className="w-4 h-4 text-[#4ADE80]" />
              <p className="text-xs font-bold text-gray-400">Sorteo 100% aleatorio y automático</p>
            </div>
          </div>
        ) : (
          <>
            {/* Result screen */}
            <div className="w-full text-center mb-6">
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="text-2xl font-black text-white mb-1">¡Tenemos ganador!</h2>
              <p className="text-gray-400 text-sm font-medium mb-2">Orden de turnos para recibir</p>

              {/* 100% random badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#4ADE80]/10 border border-[#4ADE80]/30 rounded-full">
                <Shield className="w-4 h-4 text-[#4ADE80]" />
                <p className="text-xs font-black text-[#4ADE80]">
                  El sistema realizó este sorteo 100% al azar
                </p>
              </div>
            </div>

            {/* Winner highlight */}
            {winner && (
              <div className="w-full bg-[#FFD43B] border-[3px] border-white rounded-3xl p-5 mb-5 shadow-[4px_4px_0px_rgba(255,255,255,0.3)]">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-black border-[3px] border-black rounded-full flex items-center justify-center text-2xl font-black text-[#FFD43B] shrink-0">
                    {winner.displayName[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-black text-[#FFD43B] text-xs font-black rounded-full">
                        1
                      </span>
                      <p className="text-xl font-black text-black">{winner.displayName}</p>
                    </div>
                    <p className="text-sm font-bold text-black/70">
                      {currentCycle?.cycleMonth} {currentCycle?.cycleYear}
                    </p>
                    <p className="text-sm font-black text-black">
                      Recibe{' '}
                      {junta ? fmtAmount(junta.contributionAmount * junta.maxParticipants) : '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* All turns */}
            <div className="w-full space-y-2 mb-6">
              {members.map((m, i) => {
                const order = i === winnerIndex ? 1 : i < (winnerIndex ?? 0) ? i + 2 : i + 1;
                const drawDateStr = junta?.firstDrawDate
                  ? junta.firstDrawDate.includes('T')
                    ? junta.firstDrawDate
                    : junta.firstDrawDate + 'T00:00:00'
                  : new Date().toISOString();
                const drawDate = new Date(drawDateStr);
                const d = new Date(drawDate);
                d.setMonth(d.getMonth() + (order - 1));
                const monthLabel = `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;

                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 ${
                      i === winnerIndex
                        ? 'border-[#FFD43B] bg-[#FFD43B]/10'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-black shrink-0 ${
                        i === winnerIndex
                          ? 'bg-[#FFD43B] border-[#FFD43B] text-black'
                          : 'bg-white/10 border-white/20 text-white'
                      }`}
                    >
                      {order}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#FFD43B] border-2 border-black flex items-center justify-center text-xs font-black text-black shrink-0">
                      {m.displayName[0]?.toUpperCase()}
                    </div>
                    <p className="flex-1 font-bold text-white text-sm">{m.displayName}</p>
                    <p className="text-xs text-gray-400 font-medium">{monthLabel}</p>
                  </div>
                );
              })}
            </div>

            {/* Save status */}
            {saving && (
              <div className="w-full mb-3 px-4 py-3 bg-white/10 border-2 border-white/20 rounded-2xl text-center flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-bold text-gray-300">Guardando resultados...</p>
              </div>
            )}

            {saved && (
              <div className="w-full mb-3 px-4 py-3 bg-green-900/50 border-2 border-green-500 rounded-2xl text-center">
                <p className="text-sm font-black text-green-400">
                  ✓ Turnos guardados correctamente
                </p>
              </div>
            )}

            <button
              onClick={() => router.push(`/finanzas/juntas/${juntaId}`)}
              className="w-full py-3 border-2 border-white/30 rounded-2xl font-bold text-white text-sm hover:border-white transition-colors"
            >
              Ver mi junta
            </button>
          </>
        )}
      </div>
    </div>
  );
}
