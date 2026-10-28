import type { Metadata } from 'next';
import Link from 'next/link';
import { Camera, Info } from 'lucide-react';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { providerInfo, visualThresholds } from '@/lib/visual';
import { VisualSearch } from '@/components/visual-search';
import { Alert, Card } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'Rechercher un produit par photo',
  description:
    'Prenez une photo d’un outil, d’un matériau ou d’un équipement : MeDi retrouve les produits visuellement proches dans son catalogue.',
  alternates: { canonical: '/recherche-visuelle' },
};

export const dynamic = 'force-dynamic';

export default async function VisualSearchPage() {
  const provider = providerInfo();
  const thresholds = visualThresholds();

  let indexed = 0;
  let total = 0;
  try {
    const rows = await db.execute(sql`
      SELECT count(*)::int AS total, count(*) FILTER (WHERE embedding IS NOT NULL)::int AS indexed FROM product_images
    `);
    const row = (rows.rows as { total: number; indexed: number }[])[0];
    total = row?.total ?? 0;
    indexed = row?.indexed ?? 0;
  } catch {
    /* base indisponible : la page reste informative */
  }

  const ready = provider.available && indexed > 0;

  return (
    <div className="container-page max-w-3xl py-8">
      <header className="mb-5">
        <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent-700">
          <Camera className="size-4" aria-hidden /> Recherche visuelle
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Vous ne connaissez pas le nom exact ?</h1>
        <p className="mt-2 text-sm text-navy-600">
          Photographiez le produit : nous le comparons aux photos du catalogue MeDi et proposons les références les plus proches.
          Le résultat est une aide à l’identification, pas une reconnaissance certaine.
        </p>
      </header>

      {ready ? (
        <VisualSearch />
      ) : (
        <Alert tone="warning" title="La recherche par photo n’est pas encore active">
          {provider.available
            ? `Aucune photo produit n’a encore été indexée (${indexed}/${total}). L’administrateur doit lancer l’indexation visuelle depuis /admin/import.`
            : provider.note}
          <p className="mt-2">
            En attendant, utilisez la{' '}
            <Link href="/catalogue" className="font-semibold underline">recherche par mots-clés</Link> ou{' '}
            <Link href="/contact" className="font-semibold underline">envoyez-nous la photo sur WhatsApp</Link>.
          </p>
        </Alert>
      )}

      <Card className="mt-6 p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Info className="size-4 text-navy-400" aria-hidden /> Comment ça fonctionne, honnêtement
        </h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-navy-600">
          <li>
            Chaque photo du catalogue est convertie en empreinte visuelle. Votre photo est comparée à ces empreintes (similarité
            cosinus).
          </li>
          <li>
            Fournisseur actif : <strong>{provider.label}</strong>. {provider.note}
          </li>
          <li>
            Le score affiché est un pourcentage de similarité visuelle. Au-delà de {Math.round(thresholds.confident * 100)} %, le
            produit est présenté comme « correspondance probable » ; en dessous, uniquement comme une alternative à vérifier.
          </li>
          <li>
            Aucun prix ni stock n’est déduit de l’image : seules les données de la base font foi.
          </li>
          <li>La photo envoyée est traitée en mémoire et n’est jamais enregistrée.</li>
        </ul>
      </Card>

      <p className="mt-4 text-xs text-navy-500">
        Sur mobile, l’appareil photo s’ouvre directement si le navigateur autorise la capture (HTTPS requis). Sur ordinateur,
        choisissez un fichier image.
      </p>
    </div>
  );
}
