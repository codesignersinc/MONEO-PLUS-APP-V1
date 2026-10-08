'use client';
import { useEffect, useMemo, useState } from 'react';
import { Globe2, Loader2, MapPin } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { CodeBadge } from '@/components/ui/Glyph';
import { getErrorMessage } from '@/lib/dataError';
import { CURRENCIES } from '@/lib/currency';
import { accountsService } from '@/lib/supabaseFinance';
import {
  currencyForCountry,
  suggestCountry,
  suggestLocale,
  suggestTimezone,
  timezoneCity,
  type Country,
} from '@/lib/region';
import { ipCountryFromCookie, regionService, type MyRegion } from '@/lib/supabaseRegion';

// Country, language and time zone of the user (docs/global-core.md, step 3).
// RegionConfirm: one-time card on Inicio proposing the detected region.
// RegionSettings: Configuración → "País y región".

const SUPPORTED = CURRENCIES.map((c) => c.code);
const currencyName = (code: string) => CURRENCIES.find((c) => c.code === code)?.name ?? code;

function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

function allTimeZones(current: string): string[] {
  let zones: string[] = [];
  try {
    zones =
      (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.(
        'timeZone'
      ) ?? [];
  } catch {
    zones = [];
  }
  return zones.includes(current) ? zones : [current, ...zones];
}

interface Loaded {
  countries: Country[];
  mine: MyRegion;
  hasAccounts: boolean;
}

// onlyUnconfirmed: stop after one request when the region is already confirmed (Inicio).
function useRegionData(onlyUnconfirmed = false) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    regionService
      .mine()
      .then(async (mine) => {
        if (onlyUnconfirmed && mine.confirmed) return;
        const [countries, accounts] = await Promise.all([
          regionService.countries(),
          accountsService.getAll(),
        ]);
        if (alive) setData({ countries, mine, hasAccounts: accounts.length > 0 });
      })
      .catch((e) => {
        if (alive) setError(getErrorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [onlyUnconfirmed]);
  return { data, error, setData };
}

function RegionForm({
  data,
  initialCountry,
  onSaved,
  onCancel,
}: {
  data: Loaded;
  initialCountry: string;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const offered = data.countries.filter((c) => c.status !== 'hidden');
  const [code, setCode] = useState(initialCountry);
  const country = offered.find((c) => c.code === code) ?? offered[0];
  const [tz, setTz] = useState(data.mine.timezone ?? suggestTimezone(country, deviceTimeZone()));
  const zones = useMemo(() => allTimeZones(tz), [tz]);
  const [saving, setSaving] = useState(false);

  const pickCountry = (next: string) => {
    setCode(next);
    const c = offered.find((x) => x.code === next);
    if (c) setTz(suggestTimezone(c, deviceTimeZone()));
  };

  const save = async () => {
    if (!country) return;
    setSaving(true);
    try {
      // Without accounts yet, the base currency follows the country; otherwise it stays
      // (it can be changed in Configuración → Moneda principal).
      const base = data.hasAccounts ? undefined : currencyForCountry(country, SUPPORTED);
      await regionService.save(
        country.code,
        suggestLocale(country, typeof navigator !== 'undefined' ? navigator.languages : []),
        tz,
        base
      );
      toast.showSuccess('Región guardada.');
      onSaved();
    } catch (e) {
      toast.showError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-600">
          País
        </span>
        <select
          value={code}
          onChange={(e) => pickCountry(e.target.value)}
          className="w-full rounded-xl border-[3px] border-black bg-white px-3 py-2.5 text-sm font-bold text-black"
        >
          {offered.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-600">
          Zona horaria
        </span>
        <select
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          className="w-full rounded-xl border-[3px] border-black bg-white px-3 py-2.5 text-sm font-bold text-black"
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs font-semibold text-gray-600">
        Idioma: Español. Pronto, más idiomas.
        {!data.hasAccounts && country && (
          <> Tu moneda principal será {currencyName(currencyForCountry(country, SUPPORTED))}.</>
        )}
      </p>
      {country && country.status !== 'live' && (
        <p className="rounded-xl bg-[#FFF3C4] px-3 py-2 text-xs font-bold text-black">
          MONEO todavía no tiene los bancos de {country.name}. Puedes usarlo igual registrando a
          mano, y te avisaremos cuando llegue.
        </p>
      )}
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border-[3px] border-black bg-white py-2.5 text-sm font-black text-black"
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving || !country}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border-[3px] border-black bg-[#FFD43B] py-2.5 text-sm font-black text-black shadow-[3px_3px_0px_#000] disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
        </button>
      </div>
    </div>
  );
}

/** One-time card on Inicio: "Parece que estás en Perú… ¿Correcto?". */
export function RegionConfirm() {
  const { data, setData } = useRegionData(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const suggestion = useMemo(() => {
    if (!data) return null;
    const code =
      suggestCountry(
        {
          ipCountry: ipCountryFromCookie(),
          timeZone: deviceTimeZone(),
          languages: typeof navigator !== 'undefined' ? navigator.languages : [],
        },
        data.countries
      ) ?? 'PE';
    return data.countries.find((c) => c.code === code) ?? null;
  }, [data]);

  if (!data || data.mine.confirmed || !suggestion) return null;
  const done = () => setData({ ...data, mine: { ...data.mine, confirmed: true } });
  const tz = suggestTimezone(suggestion, deviceTimeZone());

  const confirm = async () => {
    setBusy(true);
    try {
      await regionService.save(
        suggestion.code,
        suggestLocale(suggestion, navigator.languages),
        tz,
        data.hasAccounts ? undefined : currencyForCountry(suggestion, SUPPORTED)
      );
      done();
    } catch (e) {
      toast.showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[22px] border-2 border-[#111] bg-white p-4 text-[#111] shadow-[0_3px_0_#111]">
      <p className="flex items-center gap-2 text-sm font-black">
        <MapPin className="h-4 w-4" /> ¿Dónde usas MONEO?
      </p>
      {editing ? (
        <div className="mt-3">
          <RegionForm
            data={data}
            initialCountry={suggestion.code}
            onSaved={done}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm font-semibold">
            Parece que estás en <CodeBadge code={suggestion.code} /> <b>{suggestion.name}</b>, con
            la hora de {timezoneCity(tz)}
            {!data.hasAccounts && <> y {currencyName(currencyForCountry(suggestion, SUPPORTED))}</>}
            .
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 rounded-xl border-2 border-black bg-white py-2 text-sm font-black"
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-black bg-[#FFD43B] py-2 text-sm font-black disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Sí, es correcto
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Configuración → País y región. */
export function RegionSettings() {
  const { data, error, setData } = useRegionData();
  const [editing, setEditing] = useState(false);
  const current = data?.countries.find((c) => c.code === data.mine.country);

  return (
    <div className="mb-5 rounded-2xl border-[3px] border-black bg-white p-5 shadow-[6px_6px_0px_#000]">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border-[3px] border-black bg-[#75B8FF] shadow-[2px_2px_0px_#000]">
          <Globe2 className="h-4 w-4 text-black" strokeWidth={2.5} />
        </div>
        <p className="text-sm font-black uppercase tracking-wide text-black">País y región</p>
      </div>
      {error ? (
        <p className="rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]">
          {error}
        </p>
      ) : !data ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      ) : editing ? (
        <RegionForm
          data={data}
          initialCountry={data.mine.country ?? 'PE'}
          onSaved={() => {
            setEditing(false);
            regionService.mine().then((mine) => setData({ ...data, mine }));
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 text-sm font-semibold text-black">
            <p className="font-black">
              {current ? (
                <>
                  <CodeBadge code={current.code} /> {current.name}
                </>
              ) : (
                'Sin país elegido'
              )}
            </p>
            <p className="text-xs text-gray-600">
              Hora de {data.mine.timezone ? timezoneCity(data.mine.timezone) : '—'} · Español
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-xl border-2 border-black bg-[#FFF9EC] px-3 py-1.5 text-xs font-black text-black"
          >
            Cambiar
          </button>
        </div>
      )}
    </div>
  );
}
