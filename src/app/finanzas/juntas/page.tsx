'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Plus, Users, ChevronRight } from 'lucide-react';
import { juntasService, juntaMembersService, juntaCyclesService, type Junta, type JuntaMember, type JuntaCycle } from '@/lib/supabaseJuntas';

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function fmtAmount(n: number) {
  return 'S/ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

interface JuntaWithMeta extends Junta {
  memberCount: number;
  currentCycle: JuntaCycle | null;
  myTurnLabel: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  activa:     { label: 'Activa',       color: 'text-green-700',  bg: 'bg-green-100',  dot: 'bg-green-500'  },
  en_pausa:   { label: 'En pausa',     color: 'text-orange-700', bg: 'bg-orange-100', dot: 'bg-orange-500' },
  finalizada: { label: 'Finalizada',   color: 'text-gray-600',   bg: 'bg-gray-100',   dot: 'bg-gray-400'   },
  pendiente:  { label: 'Pendiente',    color: 'text-blue-700',   bg: 'bg-blue-100',   dot: 'bg-blue-500'   },
};

export default function JuntasPage() {
  const router = useRouter();
  const [juntas, setJuntas] = useState<JuntaWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadJuntas();
  }, []);

  async function loadJuntas() {
    try {
      setLoading(true);
      const raw = await juntasService.getAll();
      const enriched: JuntaWithMeta[] = await Promise.all(
        raw.map(async (j) => {
          const [members, cycles] = await Promise.all([
            juntaMembersService.getByJunta(j.id).catch(() => [] as JuntaMember[]),
            juntaCyclesService.getByJunta(j.id).catch(() => [] as JuntaCycle[]),
          ]);
          const currentCycle = cycles.find(c => c.status === 'activo') || cycles[cycles.length - 1] || null;
          return {
            ...j,
            memberCount: members.length,
            currentCycle,
            myTurnLabel: '',
          };
        })
      );
      setJuntas(enriched);
    } catch {
      setError('No se pudieron cargar las juntas.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#FFD43B] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-bold text-gray-500">Cargando juntas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Banner — contained box, rounded border, no overlay, no text */}
      <div className="px-4 pt-5 max-w-2xl mx-auto">
        <div className="w-full h-48 md:h-56 rounded-3xl border-[3px] border-black overflow-hidden shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <Image
            src="/assets/images/banner_junta-1790924659004.jpg"
            alt="Juntas - Ahorra en grupo con tus amigos y familia"
            width={800}
            height={300}
            className="w-full h-full object-cover object-center"
            priority
          />
        </div>

        {/* Title below banner */}
        <div className="mt-4 mb-1">
          <h1 className="text-3xl font-black text-black leading-tight">Juntas</h1>
          <p className="text-sm text-gray-500 font-medium mt-0.5">Ahorrar en grupo, sin complicaciones.</p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-2xl mx-auto">
        {/* CTA */}
        <Link
          href="/finanzas/juntas/nueva"
          className="flex items-center justify-center gap-2 w-full py-4 bg-[#FFD43B] border-[3px] border-black rounded-2xl font-black text-black text-base shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 mb-6"
        >
          <Plus className="w-5 h-5" strokeWidth={3} />
          Crear junta
        </Link>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border-2 border-red-400 rounded-2xl">
            <p className="text-sm font-bold text-red-600">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {juntas.length === 0 && !error && (
          <div className="text-center py-16 px-4">
            <div className="w-24 h-24 bg-[#FFD43B] border-[3px] border-black rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
              <Users className="w-12 h-12 text-black" strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-black text-black mb-2">Tu primera junta empieza aquí.</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-6 max-w-xs mx-auto">
              Invita a tus amigos, define el aporte y deja que MONEO organice el resto.
            </p>
            <Link
              href="/finanzas/juntas/nueva"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#FFD43B] border-[3px] border-black rounded-2xl font-black text-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
            >
              <Plus className="w-4 h-4" strokeWidth={3} />
              Crear mi primera junta
            </Link>
          </div>
        )}

        {/* Juntas list */}
        {juntas.length > 0 && (
          <>
            <h2 className="text-lg font-black text-black mb-3">Mis juntas</h2>
            <div className="space-y-4">
              {juntas.map((junta, idx) => {
                const st = STATUS_CONFIG[junta.status] || STATUS_CONFIG.pendiente;
                const cycle = junta.currentCycle;
                const progress = cycle ? (cycle.totalCollected / Math.max(cycle.totalExpected, 1)) : 0;
                const paidCount = cycle ? Math.round(progress * junta.memberCount) : 0;

                return (
                  <Link
                    key={junta.id}
                    href={`/finanzas/juntas/${junta.id}`}
                    className="block bg-white border-[3px] border-black rounded-3xl p-5 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0 transition-all duration-150"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-[#FFD43B] border-[3px] border-black rounded-2xl flex items-center justify-center shrink-0">
                          <Users className="w-5 h-5 text-black" strokeWidth={2.5} />
                        </div>
                        <div>
                          <h3 className="font-black text-black text-base leading-tight">{junta.name}</h3>
                          <p className="text-xs text-gray-500 font-medium">{junta.memberCount} participantes</p>
                        </div>
                      </div>
                      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border border-current ${st.color} ${st.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </div>

                    {/* Amounts row */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xl font-black text-black">{fmtAmount(junta.contributionAmount)}</p>
                        <p className="text-xs text-gray-500 font-medium capitalize">Aporte {junta.frequency}</p>
                      </div>
                      {junta.firstDrawDate && (
                        <div className="text-right">
                          <p className="text-sm font-black text-black">{fmtDate(junta.firstDrawDate)}</p>
                          <p className="text-xs text-gray-500 font-medium">Próximo aporte</p>
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    {cycle && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-gray-500">
                            {fmtAmount(cycle.totalCollected)} / {fmtAmount(cycle.totalExpected)}
                          </span>
                          <span className="text-xs font-black text-black">
                            {paidCount}/{junta.memberCount} aportes
                          </span>
                        </div>
                        <div className="h-3 bg-gray-100 border-2 border-black rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#4ADE80] rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(progress * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      {junta.myTurnLabel ? (
                        <p className="text-xs font-bold text-[#7C3AED]">Tu turno: {junta.myTurnLabel}</p>
                      ) : (
                        <p className="text-xs text-gray-400 font-medium">Ver detalles →</p>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
