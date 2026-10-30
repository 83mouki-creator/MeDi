import type { Metadata } from 'next';
import Link from 'next/link';
import { Camera, Info } from 'lucide-react';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { providerInfo } from '@/lib/visual';
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

  let indexed = 0;
  try {
    const rows = await db.execute(sql`
      SELECT count(*) FILTER (WHERE embedding IS NOT NULL)::int AS indexed FROM product_images
    `);
    indexed = (rows.rows as { indexed: number }[])[0]?.indexed ?? 0;
  } catch {
    /* catalogue momentanément indisponible : la page reste informative */
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
        <Alert tone="warning" title="La recherche par photo est momentanément indisponible">
          <p>
            En attendant, utilisez la{' '}
            <Link href="/catalogue" className="font-semibold underline">recherche par mots-clés</Link> ou{' '}
            <Link href="/contact" className="font-semibold underline">envoyez-nous la photo sur WhatsApp</Link> : nous vous
            répondons avec la référence exacte.
          </p>
        </Alert>
      )}

      <Card className="mt-6 p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Info className="size-4 text-navy-400" aria-hidden /> Comment ça marche
        </h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-navy-600">
          <li>Votre photo est comparée aux photos du catalogue, puis nous affichons les articles qui lui ressemblent le plus.</li>
          <li>
            Le pourcentage affiché exprime une ressemblance visuelle, pas une certitude : vérifiez toujours la référence, les
            dimensions et la matière avant de commander.
          </li>
          <li>Le prix et le stock affichés sont ceux de la boutique, jamais déduits de la photo.</li>
          <li>Votre photo n’est ni conservée ni publiée.</li>
          <li>
            Un doute sur une référence ? Écrivez-nous sur WhatsApp : nous confirmons le bon article avant votre commande.
          </li>
        </ul>
      </Card>

      <p className="mt-4 text-xs text-navy-500">
        Sur téléphone, l’appareil photo s’ouvre directement. Sur ordinateur, choisissez simplement une image dans vos fichiers.
      </p>
    </div>
  );
}
