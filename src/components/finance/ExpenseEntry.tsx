'use client';
import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Crown, Loader2 } from 'lucide-react';
import VoiceButton from '@/components/finance/VoiceButton';
import Glyph from '@/components/ui/Glyph';
import { parseBankMessage, type ParsedMovement } from '@/lib/auto';
import { readImageText } from '@/lib/ocr';

// "¿Cómo quieres ingresar el gasto?": scan a receipt (camera), read an image or screenshot
// (gallery), dictate it, or type it. Scan, image and voice are read with the MONEO AUTO
// interpreter on the device and only pre-fill the form: the user still picks the account
// and confirms. Nothing is stored until the form is saved; the image never leaves the phone.

export type EntryMethod = 'scan' | 'image' | 'voice' | 'manual';

export interface Prefill {
  name: string;
  amount: string;
  date: string;
  category: string | null; // label of the presets, when it can be inferred
}

export function prefillFrom(parsed: ParsedMovement): Prefill {
  return {
    name: parsed.merchant || parsed.suggestedCategory || '',
    amount: parsed.amount > 0 ? String(parsed.amount) : '',
    date: parsed.date,
    category: parsed.suggestedCategory,
  };
}

function readText(text: string): ParsedMovement | null {
  return parseBankMessage({ source: 'text', text, receivedAt: new Date() });
}

function speechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

function MethodCard({
  tone,
  art,
  title,
  desc,
  onClick,
  locked,
  children,
}: {
  tone: string;
  art: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  locked?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex min-h-[208px] flex-col rounded-[22px] border-[3px] border-[#111] p-3.5 text-left shadow-[0_4px_0_#111] transition-transform active:translate-y-0.5"
      style={{ background: tone }}
    >
      <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-[#111] text-white">
        {locked ? <Crown className="h-4 w-4" /> : <ChevronRight className="h-5 w-5" />}
      </span>
      <span
        className="flex h-[88px] items-center justify-center text-[56px] leading-none"
        aria-hidden
      >
        {art}
      </span>
      <span className="mt-2 text-[17px] font-black leading-tight text-[#111]">{title}</span>
      <span className="mt-1 text-[13px] font-semibold leading-snug text-[#111]/80">{desc}</span>
      {locked && (
        <span className="mt-2 self-start rounded-full border-2 border-[#111] bg-[#FFD83D] px-2 text-[11px] font-black">
          PLUS
        </span>
      )}
      {children}
    </button>
  );
}

export function EntryMethodPicker({
  plus,
  onPick,
  onLocked,
  onBack,
}: {
  plus: boolean;
  onPick: (m: EntryMethod) => void;
  onLocked: () => void;
  onBack: () => void;
}) {
  const pick = (m: EntryMethod) => (m !== 'manual' && !plus ? onLocked() : onPick(m));
  return (
    <div className="px-4 pb-8">
      <button
        onClick={onBack}
        className="mb-3 flex items-center gap-1.5 text-[17px] font-black text-[#111]"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.8} /> Volver
      </button>
      <div className="relative mb-5 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-[28px] font-black leading-[1.08] text-[#111]">
            ¿Cómo quieres ingresar el gasto?
          </h3>
          <p className="mt-2 text-[15px] font-semibold text-[#111]/80">
            Elige la forma más rápida y cómoda.
          </p>
        </div>
        <div className="relative h-[120px] w-[120px] shrink-0">
          <span className="absolute inset-2 rounded-full bg-[#FFD83D]" />
          <span className="absolute left-7 top-3 grid h-[84px] w-16 rotate-6 place-items-center rounded-xl border-[3px] border-[#111] bg-white text-4xl shadow-[3px_3px_0_#111]">
            <Glyph name="receipt" className="h-9 w-9 text-[#111]" />
          </span>
          <Image
            src="/assets/images/home/monedas-patrimonio.webp"
            alt=""
            width={150}
            height={100}
            className="pointer-events-none absolute -bottom-2 -left-3 w-[86px] select-none"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MethodCard
          tone="#DDF7E9"
          art={<Glyph name="camera" className="h-14 w-14 text-[#111]" />}
          title="Escanear recibo"
          desc="Toma una foto del recibo y completamos los datos."
          onClick={() => pick('scan')}
          locked={!plus}
        />
        <MethodCard
          tone="#E0EDFF"
          art={<Glyph name="image" className="h-14 w-14 text-[#111]" />}
          title="Desde una imagen o captura"
          desc="Elige una imagen de tu galería y detectamos el gasto."
          onClick={() => pick('image')}
          locked={!plus}
        />
        <MethodCard
          tone="#EDE7FF"
          art={<Glyph name="mic" className="h-14 w-14 text-[#111]" />}
          title="Por voz"
          desc="Dile a MONEO qué gastaste y lo registramos."
          onClick={() => pick('voice')}
          locked={!plus}
        >
          <span className="mt-2 rounded-xl bg-white/70 px-2.5 py-1.5 text-[12px] font-bold text-[#5B3FD1]">
            “Gasté 35 soles en taxi”
          </span>
        </MethodCard>
        <MethodCard
          tone="#FFF1C9"
          art={<Glyph name="pen" className="h-14 w-14 text-[#111]" />}
          title="Ingresar manualmente"
          desc="Completa la información del gasto."
          onClick={() => pick('manual')}
        />
      </div>
    </div>
  );
}

// Reads a photo (camera or gallery) on the device. Opens the picker as soon as it mounts.
export function ImageReader({
  camera,
  onDone,
  onCancel,
}: {
  camera: boolean;
  onDone: (prefill: Prefill | null) => void;
  onCancel: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    input.current?.click();
  }, []);

  const read = async (file: File) => {
    setProgress(0);
    try {
      const text = await readImageText(file, setProgress, (t) => readText(t) !== null);
      const parsed = text.trim() ? readText(text) : null;
      onDone(parsed ? prefillFrom(parsed) : null);
    } catch {
      onDone(null);
    }
  };

  return (
    <div className="px-4 pb-8">
      <input
        ref={input}
        type="file"
        accept="image/*"
        {...(camera ? { capture: 'environment' as const } : {})}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) read(f);
        }}
      />
      {progress === null ? (
        <div className="space-y-4 py-6 text-center">
          <p className="text-lg font-black text-[#111]">
            {camera ? 'Toma una foto del recibo' : 'Elige una imagen o captura'}
          </p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="mx-auto flex h-14 items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] px-6 text-[17px] font-black text-[#111] shadow-[0_4px_0_#111]"
          >
            <Glyph name={camera ? 'camera' : 'image'} className="h-5 w-5" />
            {camera ? 'Abrir cámara' : 'Abrir galería'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-black text-gray-700 underline"
          >
            Elegir otra forma
          </button>
        </div>
      ) : (
        <div className="space-y-3 py-10 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#111]" />
          <p className="text-lg font-black text-[#111]">Leyendo la imagen…</p>
          <div className="mx-auto h-3 w-56 overflow-hidden rounded-full border-2 border-[#111] bg-white">
            <div
              className="h-full bg-[#FFD83D] transition-[width]"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-xs font-semibold text-gray-600">La imagen se lee en tu teléfono.</p>
        </div>
      )}
    </div>
  );
}

export function VoiceReader({
  onDone,
  onCancel,
}: {
  onDone: (prefill: Prefill | null, heard: string) => void;
  onCancel: () => void;
}) {
  const [heard, setHeard] = useState('');
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(true);
  useEffect(() => setSupported(speechSupported()), []);

  return (
    <div className="space-y-5 px-4 pb-8 pt-2 text-center">
      <p className="text-[22px] font-black text-[#111]">Dime qué gastaste</p>
      <p className="text-sm font-semibold text-gray-700">
        Toca el micrófono y habla. Ej.: «gasté 35 soles en taxi», «almuerzo 18 con BCP».
      </p>
      {supported ? (
        <div className="flex justify-center [&_button]:h-20 [&_button]:w-20 [&_svg]:h-9 [&_svg]:w-9">
          <VoiceButton
            onPartial={(t) => {
              setHeard(t);
              setError('');
            }}
            onFinal={(t) => {
              setHeard(t);
              const parsed = readText(t);
              onDone(parsed ? prefillFrom(parsed) : null, t);
            }}
            onError={setError}
          />
        </div>
      ) : (
        <p className="rounded-2xl bg-[#FFE1DB] p-3 text-sm font-bold text-[#B42318]">
          Tu navegador no permite dictar. Usa otra forma de ingresar el gasto.
        </p>
      )}
      {heard && (
        <p className="rounded-2xl border-2 border-[#111] bg-white p-3 text-base font-bold text-[#111]">
          “{heard}”
        </p>
      )}
      {error && <p className="text-sm font-bold text-[#B42318]">{error}</p>}
      <button
        type="button"
        onClick={onCancel}
        className="text-sm font-black text-gray-700 underline"
      >
        Elegir otra forma
      </button>
    </div>
  );
}
