'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronRight,
  Users,
  Calendar,
  Lock,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
} from 'lucide-react';
import {
  juntasService,
  juntaMembersService,
  juntaCyclesService,
  juntaInvitesService,
  juntaEventsService,
} from '@/lib/supabaseJuntas';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import Glyph from '@/components/ui/Glyph';
import { getErrorMessage } from '@/lib/dataError';
import { currencySymbol, formatMoney, monthNames } from '@/lib/format';

const PARTICIPANT_OPTIONS = [4, 6, 8, 10, 12];
const MONTHS_FULL = monthNames('long', { capitalize: true });

const FREQUENCY_OPTIONS = [
  { value: 'semanal', label: 'Semanal', desc: 'Aportes cada semana' },
  { value: 'quincenal', label: 'Quincenal', desc: 'Aportes cada 15 días' },
  { value: 'mensual', label: 'Mensual', desc: 'Aportes cada mes' },
];

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

interface StepProps {
  step: number;
  total: number;
}

function StepIndicator({ step, total }: StepProps) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <div
            className={`w-8 h-8 rounded-full border-[3px] border-black flex items-center justify-center text-xs font-black transition-all ${
              i + 1 === step
                ? 'bg-[#FFD43B] text-black'
                : i + 1 < step
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-400'
            }`}
          >
            {i + 1 < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div
              className={`flex-1 h-1 rounded-full transition-all ${i + 1 < step ? 'bg-black' : 'bg-gray-200'}`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function NuevaJuntaPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  // Step 1
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Step 2
  const [amount, setAmount] = useState('500');
  const [frequency, setFrequency] = useState('mensual');
  const [participants, setParticipants] = useState(8);
  const [customParticipants, setCustomParticipants] = useState('');
  const [firstDrawDate, setFirstDrawDate] = useState('');
  const [firstDrawTime, setFirstDrawTime] = useState('20:00');

  // Step 3
  const [paymentConfirmation, setPaymentConfirmation] = useState('comprobante');
  const [paymentDeadlineDay, setPaymentDeadlineDay] = useState(10);
  const [latePolicy, setLatePolicy] = useState('aviso_automatico');
  const [isPrivate, setIsPrivate] = useState(true);
  const [additionalNotes, setAdditionalNotes] = useState('');

  const effectiveParticipants = customParticipants
    ? parseInt(customParticipants) || participants
    : participants;

  function handleNext() {
    setError('');
    if (step === 1) {
      if (!name.trim()) {
        setError('El nombre de la junta es obligatorio.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!amount || parseFloat(amount) <= 0) {
        setError('Ingresa un monto válido.');
        return;
      }
      if (!firstDrawDate) {
        setError('Selecciona la fecha y hora del primer sorteo.');
        return;
      }
      setStep(3);
    }
  }

  async function handleCreate() {
    setError('');
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('No estás autenticado. Por favor inicia sesión.');

      // Upsert user profile to ensure FK constraint is satisfied
      let displayName = user.email?.split('@')[0] || 'Tú';
      try {
        await supabase.from('user_profiles').upsert(
          {
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || displayName,
          },
          { onConflict: 'id' }
        );

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        if (profile?.full_name) displayName = profile.full_name as string;
      } catch {
        // profile upsert failed — continue anyway, FK now points to auth.users
      }

      const junta = await juntasService.create({
        name: name.trim(),
        description: description.trim(),
        contributionAmount: parseFloat(amount),
        frequency,
        maxParticipants: effectiveParticipants,
        firstDrawDate: firstDrawDate.includes('T')
          ? firstDrawDate
          : `${firstDrawDate}T${firstDrawTime}:00`,
        paymentConfirmation,
        paymentDeadlineDay,
        latePolicy,
        isPrivate,
        additionalNotes: additionalNotes.trim(),
        status: 'activa',
      });

      if (!junta) throw new Error('No se pudo crear la junta.');
      // From here on the junta exists: follow-up failures are warnings, never a
      // form error (retrying the form would create a duplicate junta).

      // Add creator as admin member
      try {
        await juntaMembersService.create({
          juntaId: junta.id,
          userId: user.id,
          displayName,
          email: user.email || '',
          role: 'admin',
          status: 'unido',
          joinedAt: new Date().toISOString(),
        });
      } catch (memberErr) {
        console.error('junta admin member creation failed:', memberErr);
        toast.showError('La junta se creó, pero no se pudo agregarte como administrador.');
      }

      // Create first cycle (non-blocking — don't abort junta creation if this fails)
      const drawDateStr = firstDrawDate.includes('T')
        ? firstDrawDate
        : `${firstDrawDate}T${firstDrawTime}:00`;
      const drawDate = new Date(drawDateStr);
      juntaCyclesService
        .create({
          juntaId: junta.id,
          cycleNumber: 1,
          cycleMonth: MONTHS_FULL[drawDate.getMonth()],
          cycleYear: drawDate.getFullYear(),
          totalExpected: parseFloat(amount) * effectiveParticipants,
          totalCollected: 0,
          status: 'activo',
          drawWinnerMemberId: null,
          drawPerformedAt: null,
          drawSeed: null,
        })
        .catch((err) => {
          // Non-blocking — the cycle can be created later, but tell the user.
          console.error('junta first cycle creation failed:', err);
          toast.showError('La junta se creó, pero no se pudo crear el primer ciclo.');
        });

      // Create invite code (non-blocking)
      const code = generateInviteCode();
      juntaInvitesService.create(junta.id, code).catch((err) => {
        console.error('junta invite creation failed:', err);
        toast.showError('La junta se creó, pero no se pudo generar el código de invitación.');
      });

      // Log event (non-blocking; history only, so log without bothering the user)
      juntaEventsService
        .create({
          juntaId: junta.id,
          actorMemberId: null,
          eventType: 'junta_creada',
          description: `Junta "${junta.name}" creada`,
          metadata: { amount: parseFloat(amount), participants: effectiveParticipants, frequency },
        })
        .catch((err) => console.error('junta event log failed:', err));

      router.push(`/finanzas/juntas/${junta.id}?created=1`);
    } catch (e: unknown) {
      // Supabase errors carry a `code`: translate them; keep our own messages as-is.
      const isSupabaseError = typeof e === 'object' && e !== null && 'code' in e;
      const msg = !isSupabaseError && e instanceof Error ? e.message : getErrorMessage(e);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <div className="sticky top-[env(safe-area-inset-top)] z-10 bg-[#FAFAF8] border-b-2 border-black px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => (step > 1 ? setStep((s) => s - 1) : router.back())}
          className="w-9 h-9 rounded-xl border-2 border-black bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-black" strokeWidth={2.5} />
        </button>
        <div>
          <h1 className="text-lg font-black text-black leading-tight">
            {step === 1
              ? 'Información de la junta'
              : step === 2
                ? 'Configuración'
                : 'Reglas de la junta'}
          </h1>
          <p className="text-xs text-gray-500 font-medium">{step} de 3</p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto">
        <StepIndicator step={step} total={3} />

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border-2 border-red-400 rounded-2xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-sm font-bold text-red-600">{error}</p>
          </div>
        )}

        {/* ── STEP 1: Información ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="bg-[#FFD43B] border-[3px] border-black rounded-3xl p-5 mb-2">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-8 h-8 text-black" strokeWidth={2} />
                <div>
                  <p className="font-black text-black text-base">Junta de ahorro</p>
                  <span className="px-2 py-0.5 bg-black text-[#FFD43B] text-[10px] font-black rounded-full">
                    Popular
                  </span>
                </div>
              </div>
              <p className="text-sm text-black/80 font-medium">
                Todos aportan periódicamente y se hace un sorteo para definir quién recibe el fondo.
              </p>
              <div className="mt-3 space-y-1">
                {[
                  'Fácil de organizar',
                  'Sorteo automático',
                  'Todo queda registrado',
                  'Sin complicaciones',
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
                    <span className="text-xs font-bold text-black">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-wide">
                Nombre de la junta *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Junta de amigos"
                className="mt-1.5 w-full px-4 py-3 border-[3px] border-black rounded-2xl text-sm font-bold text-black outline-none focus:border-[#FFD43B] bg-white transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-wide">
                Descripción (opcional)
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. Para nuestro viaje a Europa"
                className="mt-1.5 w-full px-4 py-3 border-[3px] border-black rounded-2xl text-sm font-medium text-black outline-none focus:border-[#FFD43B] bg-white transition-colors"
              />
            </div>

            <button
              onClick={handleNext}
              className="w-full py-4 bg-[#FFD43B] border-[3px] border-black rounded-2xl font-black text-black text-base shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all flex items-center justify-center gap-2"
            >
              Continuar <ChevronRight className="w-5 h-5" strokeWidth={3} />
            </button>
          </div>
        )}

        {/* ── STEP 2: Configuración ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-wide">
                Monto de aporte ({currencySymbol()})
              </label>
              <div className="mt-1.5 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-sm">
                  {currencySymbol()}
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500.00"
                  className="w-full pl-10 pr-4 py-3 border-[3px] border-black rounded-2xl text-sm font-bold text-black outline-none focus:border-[#FFD43B] bg-white transition-colors"
                />
              </div>
            </div>

            {/* Frecuencia dropdown */}
            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-wide">
                Frecuencia
              </label>
              <div className="mt-1.5 relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border-[3px] border-black rounded-2xl text-sm font-bold text-black outline-none focus:border-[#FFD43B] bg-white transition-colors appearance-none cursor-pointer"
                >
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} — {opt.desc}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-wide">
                Número de participantes
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {PARTICIPANT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      setParticipants(n);
                      setCustomParticipants('');
                    }}
                    className={`px-4 py-2.5 rounded-xl border-[3px] text-sm font-black transition-all ${
                      participants === n && !customParticipants
                        ? 'border-black bg-[#FFD43B] text-black shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                        : 'border-gray-200 text-gray-600 hover:border-black'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <input
                  type="number"
                  value={customParticipants}
                  onChange={(e) => setCustomParticipants(e.target.value)}
                  placeholder="Otro"
                  className={`w-20 px-3 py-2.5 rounded-xl border-[3px] text-sm font-bold text-black outline-none transition-all ${
                    customParticipants ? 'border-black bg-[#FFD43B]' : 'border-gray-200'
                  }`}
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500 font-medium">
                Fondo total:{' '}
                {amount ? `${formatMoney(parseFloat(amount) * effectiveParticipants)}` : '—'}
              </p>
            </div>

            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-wide">
                Fecha del primer sorteo
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={
                      firstDrawDate.includes('T') ? firstDrawDate.split('T')[0] : firstDrawDate
                    }
                    onChange={(e) => setFirstDrawDate(e.target.value)}
                    className="w-full px-3 py-3 border-[3px] border-black rounded-2xl text-sm font-bold text-black outline-none focus:border-[#FFD43B] bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={firstDrawTime}
                    onChange={(e) => setFirstDrawTime(e.target.value)}
                    className="w-full px-3 py-3 border-[3px] border-black rounded-2xl text-sm font-bold text-black outline-none focus:border-[#FFD43B] bg-white transition-colors"
                  />
                </div>
              </div>
              <p className="mt-1.5 text-xs text-gray-500 font-medium flex items-center gap-1">
                <Glyph name="alarm" className="h-3.5 w-3.5" /> El sorteo automático se realizará en
                esta fecha y hora exacta
              </p>
            </div>

            <button
              onClick={handleNext}
              className="w-full py-4 bg-[#FFD43B] border-[3px] border-black rounded-2xl font-black text-black text-base shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all flex items-center justify-center gap-2"
            >
              Continuar <ChevronRight className="w-5 h-5" strokeWidth={3} />
            </button>
          </div>
        )}

        {/* ── STEP 3: Reglas ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-wide">
                ¿Cómo se confirma el pago?
              </label>
              <div className="mt-1.5 space-y-2">
                {[
                  { value: 'comprobante', label: 'Comprobante + confirmación', icon: 'camera' },
                  { value: 'honor', label: 'Sistema de honor', icon: 'handshake' },
                  { value: 'admin', label: 'El admin confirma', icon: 'user' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPaymentConfirmation(opt.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-[3px] text-sm font-bold transition-all ${
                      paymentConfirmation === opt.value
                        ? 'border-black bg-[#FFD43B] text-black shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                        : 'border-gray-200 text-gray-600 bg-white hover:border-black'
                    }`}
                  >
                    <Glyph name={opt.icon} className="h-5 w-5 shrink-0" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-wide">
                Día límite del aporte cada mes
              </label>
              <div className="mt-1.5 flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={paymentDeadlineDay}
                  onChange={(e) => setPaymentDeadlineDay(parseInt(e.target.value) || 10)}
                  className="w-24 px-4 py-3 border-[3px] border-black rounded-2xl text-sm font-bold text-black outline-none focus:border-[#FFD43B] bg-white text-center"
                />
                <span className="text-sm font-bold text-gray-500">de cada mes</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-wide">
                ¿Qué pasa si alguien se retrasa?
              </label>
              <div className="mt-1.5 space-y-2">
                {[
                  {
                    value: 'aviso_automatico',
                    label: 'Aviso automático + 2 días de tolerancia',
                    icon: 'alarm',
                  },
                  { value: 'suspension', label: 'Suspensión temporal', icon: 'ban' },
                  { value: 'flexible', label: 'Flexible, el admin decide', icon: 'chat' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setLatePolicy(opt.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-[3px] text-sm font-bold transition-all ${
                      latePolicy === opt.value
                        ? 'border-black bg-[#FFD43B] text-black shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                        : 'border-gray-200 text-gray-600 bg-white hover:border-black'
                    }`}
                  >
                    <Glyph name={opt.icon} className="h-5 w-5 shrink-0" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-wide">
                Notas adicionales (opcional)
              </label>
              <textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Solo amigos. Compromiso serio para el viaje"
                rows={3}
                className="mt-1.5 w-full px-4 py-3 border-[3px] border-black rounded-2xl text-sm font-medium text-black outline-none focus:border-[#FFD43B] bg-white transition-colors resize-none"
              />
            </div>

            <div className="flex items-center justify-between px-4 py-3 bg-white border-[3px] border-black rounded-2xl">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-sm font-black text-black">Junta privada</p>
                  <p className="text-xs text-gray-500 font-medium">
                    Solo personas con invitación pueden unirse.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPrivate((p) => !p)}
                className={`w-12 h-6 rounded-full border-2 border-black transition-all ${isPrivate ? 'bg-[#FFD43B]' : 'bg-gray-200'}`}
              >
                <div
                  className={`w-4 h-4 bg-black rounded-full transition-all mx-0.5 ${isPrivate ? 'translate-x-6' : 'translate-x-0'}`}
                />
              </button>
            </div>

            <button
              onClick={handleCreate}
              disabled={saving}
              className="w-full py-4 bg-[#FFD43B] border-[3px] border-black rounded-2xl font-black text-black text-base shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Creando junta...
                </>
              ) : (
                <>
                  Crear junta <ChevronRight className="w-5 h-5" strokeWidth={3} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
