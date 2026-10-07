'use client';
import React, { useCallback, useEffect, useState } from 'react';
import LoadError from '@/components/ui/LoadError';
import { useAuth } from '@/contexts/AuthContext';
import { householdService, type MyHousehold } from '@/lib/supabaseHousehold';
import CreateHousehold from '@/components/household/CreateHousehold';
import HouseholdView from '@/components/household/HouseholdView';

// MONEO HOGAR: shared household finances ("Nuestro dinero"), without mixing anybody's
// personal accounts.
export default function HogarPage() {
  const { user } = useAuth();
  const [data, setData] = useState<MyHousehold | null | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    setError(null);
    householdService.getMine().then(setData).catch(setError);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fullName: string = user?.user_metadata?.full_name || '';
  const first = fullName.trim().split(/\s+/)[0] || user?.email?.split('@')[0] || '';
  const defaultName = first ? first.charAt(0).toUpperCase() + first.slice(1) : '';

  return (
    <div className="min-h-screen bg-[#FFF9EC] font-poppins text-[#111]">
      <div className="mx-auto max-w-[1280px] px-4 pb-28 pt-5 lg:px-6">
        {error ? (
          <LoadError what="tu hogar" error={error} onRetry={load} />
        ) : data === undefined ? (
          <p className="py-16 text-center text-sm font-bold text-gray-600">Cargando…</p>
        ) : data === null ? (
          <CreateHousehold defaultName={defaultName} onCreated={load} />
        ) : (
          <HouseholdView data={data} onReload={load} onGone={() => setData(null)} />
        )}
      </div>
    </div>
  );
}
