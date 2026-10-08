'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { APP_LOCALE } from '@/lib/locale';

// Dictation with the browser's own speech recognition (Chrome, Edge, Safari). The audio
// is handled by the browser/OS speech service; MONEO only receives the transcribed text.
// Renders nothing where the browser has no speech recognition.

interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechCtor = new () => SpeechRecognitionLike;

function getSpeechCtor(): SpeechCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Permite el uso del micrófono para dictar.',
  'service-not-allowed': 'Permite el uso del micrófono para dictar.',
  'no-speech': 'No te escuchamos. Toca el micrófono e intenta de nuevo.',
  'audio-capture': 'No encontramos un micrófono.',
  network: 'El dictado necesita conexión a internet.',
};

interface Props {
  // Text heard so far (updates while speaking).
  onPartial: (text: string) => void;
  // Final text when the user stops talking.
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

export default function VoiceButton({ onPartial, onFinal, onError, disabled }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');

  useEffect(() => {
    setSupported(!!getSpeechCtor());
    return () => recRef.current?.abort();
  }, []);

  if (!supported) return null;

  const start = () => {
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = APP_LOCALE;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    finalRef.current = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      onPartial((finalRef.current + interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error !== 'aborted') onError(ERRORS[e.error] ?? 'No pudimos usar el dictado.');
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      const text = finalRef.current.trim();
      if (text) onFinal(text);
    };
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      onError('No pudimos usar el dictado.');
    }
  };

  return (
    <button
      type="button"
      onClick={() => (listening ? recRef.current?.stop() : start())}
      disabled={disabled && !listening}
      aria-label={listening ? 'Detener dictado' : 'Dictar por voz'}
      title={listening ? 'Detener' : 'Dictar por voz'}
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[3px] border-black text-white shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 ${
        listening ? 'bg-[#B91C1C]' : 'bg-[#EF4444] hover:-translate-y-0.5'
      }`}
    >
      {listening && (
        <span
          className="absolute inset-0 animate-ping rounded-xl bg-[#EF4444] opacity-40"
          aria-hidden="true"
        />
      )}
      {listening ? (
        <Square className="relative h-4 w-4 fill-white text-white" />
      ) : (
        <Mic className="h-5 w-5 text-white" strokeWidth={2.5} />
      )}
    </button>
  );
}
