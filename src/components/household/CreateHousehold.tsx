'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { ArrowRight, Lock, Scale, Target, Users } from 'lucide-react';
import { SubmitButton, TextField } from '@/components/finance/formKit';
import { householdService } from '@/lib/supabaseHousehold';
import { getErrorMessage } from '@/lib/dataError';
import { track } from '@/lib/analytics';
import { Choice, ErrorNote, SectionLabel } from '@/components/household/ui';

// First visit to MONEO HOGAR: what it is and the form to create the household.
export default function CreateHousehold({
  defaultName,
  onCreated,
}: {
  defaultName: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Nuestro hogar');
  const [subtitle, setSubtitle] = useState('');
  const [displayName, setDisplayName] = useState(defaultName);
  const [currency, setCurrency] = useState<'PEN' | 'USD' | 'EUR'>('PEN');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    if (!name.trim() || !displayName.trim()) {
      setError('Escribe el nombre del hogar y tu nombre.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await householdService.create({
        name: name.trim(),
        subtitle: subtitle.trim(),
        displayName: displayName.trim(),
        baseCurrency: currency,
      });
      track('household_created', { currency });
      onCreated();
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <section className="relative overflow-hidden rounded-[24px] border-2 border-[#111] bg-[#FFD83D] p-5 shadow-[0_3px_0_#111] sm:p-6">
        <Image
          src="/assets/images/home/monedas-patrimonio.webp"
          alt=""
          aria-hidden
          width={500}
          height={333}
          className="pointer-events-none absolute -right-6 -top-4 w-[150px] select-none sm:w-[190px]"
        />
        <p className="text-[13px] font-black uppercase tracking-wide text-[#111]/70">MONEO HOGAR</p>
        <h1 className="mt-1 max-w-[70%] text-[28px] font-black leading-[1.08] text-[#111] sm:text-[32px]">
          Tu hogar empieza aquí.
        </h1>
        <p className="mt-2 max-w-[85%] text-[15px] font-semibold text-[#111]/80">
          Comparte gastos, metas y responsabilidades sin mezclar tus cuentas personales.
        </p>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-5 flex h-14 items-center gap-2 rounded-2xl border-[3px] border-[#111] bg-white px-5 text-[17px] font-black text-[#111] shadow-[0_4px_0_#111] active:translate-y-0.5"
          >
            Crear mi hogar <ArrowRight className="h-5 w-5" />
          </button>
        )}
      </section>

      {!open ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            {
              icon: Lock,
              title: 'Tus cuentas siguen siendo tuyas',
              text: 'Nadie ve tus saldos ni tus movimientos privados. Solo se comparte lo del hogar.',
            },
            {
              icon: Scale,
              title: 'Reparto claro',
              text: '50/50, según ingresos o como prefieran. MONEO calcula quién aportó de más.',
            },
            {
              icon: Users,
              title: 'Juntos, al día',
              text: 'Gastos de la casa, próximos pagos y presupuesto en un solo lugar.',
            },
            {
              icon: Target,
              title: 'Metas en pareja o familia',
              text: 'Fondo de emergencia, viaje o casa, con los aportes de cada uno.',
            },
          ].map((f) => (
            <li
              key={f.title}
              className="flex gap-3 rounded-[20px] border-2 border-[#111] bg-white p-4 shadow-[0_3px_0_#111]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-[#111] bg-[#DDF7E9]">
                <f.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-[15px] font-black text-[#111]">{f.title}</span>
                <span className="block text-[13px] font-semibold text-[#111]/75">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <section className="space-y-4 rounded-[24px] border-2 border-[#111] bg-white p-5 shadow-[0_3px_0_#111]">
          <h2 className="text-[20px] font-black text-[#111]">¿Quieres organizar tu hogar?</h2>
          <TextField
            label="Nombre del hogar"
            value={name}
            onChange={setName}
            placeholder="Ej. Nuestro hogar"
          />
          <TextField
            label="Nombre del grupo (opcional)"
            value={subtitle}
            onChange={setSubtitle}
            placeholder="Ej. Félix + Sophia"
          />
          <TextField
            label="Tu nombre en el hogar"
            value={displayName}
            onChange={setDisplayName}
            placeholder="Ej. Félix"
          />
          <div>
            <SectionLabel>Moneda del hogar</SectionLabel>
            <Choice
              label="Moneda del hogar"
              value={currency}
              onChange={setCurrency}
              options={[
                { value: 'PEN', label: 'S/ Soles' },
                { value: 'USD', label: '$ Dólares' },
                { value: 'EUR', label: '€ Euros' },
              ]}
            />
            <p className="mt-1.5 text-xs font-semibold text-gray-600">
              Los gastos en otra moneda guardan su equivalente con el tipo de cambio del día.
            </p>
          </div>
          <p className="text-xs font-semibold text-gray-600">
            Tu nombre en el hogar lo verán las personas que invites. Tus cuentas, saldos y
            movimientos siguen siendo privados.
          </p>
          {error && <ErrorNote>{error}</ErrorNote>}
          <SubmitButton onClick={create} disabled={saving}>
            {saving ? 'Creando…' : 'Crear mi hogar'}
          </SubmitButton>
        </section>
      )}
    </div>
  );
}
