'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu } from 'lucide-react';
import { useSiteT } from './site-i18n';
import { cn } from '@/lib/utils';

export type SiteCategoryMenuEntry = { id: string; slug: string; name: string };

/**
 * Menu des rayons, sur téléphone.
 *
 * Remplace l'ancien `<details>` natif, qui restait ouvert après un clic à côté
 * et laissait son panneau flotter au-dessus de la page — surtout visible en
 * arabe, où le panneau se superposait au contenu.
 *
 * Ici le panneau est monté **seulement** quand le menu est ouvert : rien ne
 * peut rester affiché après coup. Il se referme au clic à l'extérieur, à la
 * touche Échap, au changement de page et au clic sur un rayon.
 */
export function SiteCategoryMenu({ categories }: { categories: SiteCategoryMenuEntry[] }) {
  const t = useSiteT();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();

  // Un changement de page referme le panneau (navigation par lien).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent | MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex items-center gap-2 rounded-lg px-2 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
      >
        <Menu className="size-5" aria-hidden />
        {t('Catégories')}
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute start-0 top-full z-50 mt-1 max-h-[70vh] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-navy-100 bg-white p-2 text-navy-900 shadow-xl"
        >
          <ul>
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/categorie/${category.slug}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-navy-50"
                >
                  {category.name}
                </Link>
              </li>
            ))}
            <li className="mt-1 border-t border-navy-100 pt-1">
              <Link
                href="/catalogue"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-accent-700 hover:bg-navy-50"
              >
                {t('Tout le catalogue')}
              </Link>
            </li>
            <li>
              <Link
                href="/nous-trouver"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-navy-800 hover:bg-navy-50"
              >
                {t('Nous trouver')}
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
