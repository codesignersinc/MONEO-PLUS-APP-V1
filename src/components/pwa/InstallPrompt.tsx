'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { MoreVertical, Share, SquarePlus, X } from 'lucide-react';
import { track } from '@/lib/analytics';
import { useDataChanged } from '@/lib/dataSync';
import { todayLocal } from '@/lib/dates';
import {
  detectInstallPlatform,
  recordVisit,
  shouldShowInstall,
  snoozeUntil,
  type InstallPlatform,
  type InstallState,
} from '@/lib/pwaInstall';

// Small "Instala MONEO+ en tu celular" card. Android (Chromium) opens the system install
// dialog with one tap; iPhone can't be triggered by a web page, so it shows the Share →
// "Agregar a inicio" steps. Inside Instagram/Facebook/WhatsApp it asks to open the browser.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallWindow extends Window {
  __moneoInstallPrompt?: InstallPromptEvent | null;
}

const KEY = 'moneo.pwa.install';
const INSTALLED = '9999-12-31';
const EMPTY: InstallState = { snoozedUntil: null, visitDays: [], engaged: false };

function readState(): InstallState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeState(s: InstallState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode: the card just shows again next time.
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstallPrompt() {
  const pathname = usePathname();
  const [platform, setPlatform] = useState<InstallPlatform>('none');
  const [visible, setVisible] = useState(false);
  const [steps, setSteps] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);

  // Registering anything counts as "already sees value" → the card may appear.
  useDataChanged(() => {
    const s = readState();
    if (s.engaged) return;
    const next = { ...s, engaged: true };
    writeState(next);
    if (shouldShowInstall(platform, isStandalone(), next, todayLocal())) setVisible(true);
  });

  useEffect(() => {
    const w = window as InstallWindow;
    const p = detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints);
    setPlatform(p);
    setCanPrompt(!!w.__moneoInstallPrompt);
    const s = readState();
    const today = todayLocal();
    const next = { ...s, visitDays: recordVisit(s.visitDays, today) };
    writeState(next);
    // A few seconds in, not on top of the first paint.
    const t = window.setTimeout(() => {
      if (shouldShowInstall(p, isStandalone(), next, today)) setVisible(true);
    }, 4000);

    const onAvailable = () => setCanPrompt(true);
    const onInstalled = () => {
      writeState({ ...readState(), snoozedUntil: INSTALLED });
      setVisible(false);
      track('pwa_installed', { platform: p });
    };
    window.addEventListener('moneo:install-available', onAvailable);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('moneo:install-available', onAvailable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const hidden = !visible || pathname.startsWith('/finanzas/plus');

  useEffect(() => {
    if (!hidden) track('pwa_install_prompt_shown', { platform });
  }, [hidden, platform]);

  if (hidden) return null;

  const dismiss = () => {
    writeState({ ...readState(), snoozedUntil: snoozeUntil(todayLocal()) });
    setVisible(false);
    track('pwa_install_dismissed', { platform });
  };

  const install = async () => {
    track('pwa_install_clicked', { platform });
    const w = window as InstallWindow;
    const ev = w.__moneoInstallPrompt;
    if (!ev) {
      setSteps(true);
      return;
    }
    w.__moneoInstallPrompt = null;
    setCanPrompt(false);
    try {
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      if (outcome === 'accepted') {
        track('pwa_install_accepted', { platform });
        writeState({ ...readState(), snoozedUntil: INSTALLED });
        setVisible(false);
      } else {
        dismiss();
      }
    } catch {
      setSteps(true);
    }
  };

  const oneTap = platform === 'android' && canPrompt;
  const subtitle =
    platform === 'in-app'
      ? 'Ábrela en tu navegador para instalarla.'
      : 'Ábrela como una app, sin Play Store ni App Store.';

  return (
    <div
      role="dialog"
      aria-label="Instala MONEO+ en tu celular"
      className="lg:hidden fixed left-3 right-3 bottom-[calc(92px+env(safe-area-inset-bottom))] z-[45] rounded-2xl border-2 border-black bg-white p-3 text-[#111] shadow-[3px_3px_0px_rgba(0,0,0,1)] animate-fade-in"
    >
      <div className="flex items-center gap-3">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-xl border-2 border-black"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-black leading-tight">Instala MONEO+ en tu celular</p>
          <p className="text-xs font-semibold leading-snug text-[#555]">{subtitle}</p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Ahora no"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black"
        >
          <X className="h-4 w-4" strokeWidth={3} />
        </button>
      </div>

      {steps || platform === 'in-app' ? (
        <ol className="mt-3 space-y-2 rounded-xl bg-[#F4F1EA] p-3 text-[13px] font-bold">
          <Steps platform={platform} />
        </ol>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={dismiss}
            className="flex-1 rounded-xl border-2 border-black bg-white py-2.5 text-sm font-black"
          >
            Ahora no
          </button>
          <button
            onClick={oneTap ? install : () => setSteps(true)}
            className="flex-[1.4] rounded-xl border-2 border-black bg-[#FFD83D] py-2.5 text-sm font-black shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none"
          >
            {oneTap ? 'Instalar' : 'Ver cómo'}
          </button>
        </div>
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black text-xs font-black text-white">
        {n}
      </span>
      <span className="flex flex-wrap items-center gap-1">{children}</span>
    </li>
  );
}

function Key({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-black/20 bg-white px-1.5 py-0.5">
      {children}
    </span>
  );
}

function Steps({ platform }: { platform: InstallPlatform }) {
  if (platform === 'in-app') {
    return (
      <>
        <Step n={1}>
          Toca <Key>•••</Key> o <Key>⋮</Key> arriba
        </Step>
        <Step n={2}>
          Elige <Key>Abrir en el navegador</Key>
        </Step>
        <Step n={3}>Ahí te mostraremos cómo instalarla</Step>
      </>
    );
  }
  if (platform === 'ios-safari') {
    return (
      <>
        <Step n={1}>
          Toca{' '}
          <Key>
            <Share className="h-3.5 w-3.5" strokeWidth={2.6} /> Compartir
          </Key>
          <span className="text-[11px] font-semibold text-[#666]">(si no lo ves, toca •••)</span>
        </Step>
        <Step n={2}>
          Elige{' '}
          <Key>
            <SquarePlus className="h-3.5 w-3.5" strokeWidth={2.6} /> Agregar a inicio
          </Key>
        </Step>
        <Step n={3}>
          Toca <Key>Agregar</Key> y listo
        </Step>
      </>
    );
  }
  return (
    <>
      <Step n={1}>
        Toca{' '}
        <Key>
          <MoreVertical className="h-3.5 w-3.5" strokeWidth={2.6} />
        </Key>
        arriba a la derecha
      </Step>
      <Step n={2}>
        Elige <Key>Instalar app</Key> o <Key>Agregar a pantalla principal</Key>
      </Step>
      <Step n={3}>
        Toca <Key>Instalar</Key> y listo
      </Step>
    </>
  );
}
