import type { ReactNode } from 'react';

/** Mise en page commune aux pages légales (texte long, lisible, sobre). */
export function LegalPage({
  title,
  updatedAt,
  intro,
  children,
}: {
  title: string;
  updatedAt?: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <article className="container-page max-w-3xl py-8">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      {updatedAt ? <p className="mt-1 text-xs text-navy-500">Dernière mise à jour : {updatedAt}</p> : null}
      {intro ? <p className="mt-3 text-sm leading-relaxed text-navy-700">{intro}</p> : null}
      <div className="mt-6 space-y-5 text-sm leading-relaxed text-navy-700">{children}</div>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 text-base font-bold text-navy-950">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
