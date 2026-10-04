import React from 'react';
import Link from 'next/link';

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

// Static legal page. Both pages are drafts pending legal review: the banner
// must stay until a lawyer approves the final text.
export default function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-screen bg-[#FFFBEB] px-4 py-8">
      <article className="max-w-2xl mx-auto space-y-6">
        <Link href="/finanzas" className="text-sm font-bold underline">
          ← Volver a MONEO+
        </Link>
        <div
          role="note"
          className="rounded-2xl border-[3px] border-black bg-[#FDE68A] p-4 text-sm font-bold"
        >
          Borrador pendiente de revisión legal. Este texto puede cambiar antes de su versión
          definitiva.
        </div>
        <header>
          <h1 className="text-3xl font-black text-black">{title}</h1>
          <p className="text-xs font-bold text-black/60 mt-1">Última actualización: {updated}</p>
        </header>
        {sections.map((s) => (
          <section key={s.title} className="space-y-2">
            <h2 className="text-lg font-black text-black">{s.title}</h2>
            {s.paragraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-black/80">
                {p}
              </p>
            ))}
          </section>
        ))}
      </article>
    </main>
  );
}
