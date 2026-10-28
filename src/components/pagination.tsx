import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Pagination conservant tous les filtres présents dans l'URL. */
export function Pagination({
  page,
  totalPages,
  basePath,
  searchParams,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== 'page') params.set(key, value);
    }
    if (target > 1) params.set('page', String(target));
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const pages = buildPages(page, totalPages);

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-1">
      <Link
        href={href(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={cn(
          'inline-flex size-10 items-center justify-center rounded-lg border border-navy-200 bg-white text-navy-700 hover:bg-navy-50',
          page === 1 && 'pointer-events-none opacity-40',
        )}
        aria-label="Page précédente"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Link>

      {pages.map((p, index) =>
        p === 'ellipsis' ? (
          <span key={`e${index}`} className="px-2 text-navy-400">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'inline-flex size-10 items-center justify-center rounded-lg border text-sm font-semibold',
              p === page
                ? 'border-accent-500 bg-accent-500 text-white'
                : 'border-navy-200 bg-white text-navy-700 hover:bg-navy-50',
            )}
          >
            {p}
          </Link>
        ),
      )}

      <Link
        href={href(Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        className={cn(
          'inline-flex size-10 items-center justify-center rounded-lg border border-navy-200 bg-white text-navy-700 hover:bg-navy-50',
          page === totalPages && 'pointer-events-none opacity-40',
        )}
        aria-label="Page suivante"
      >
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </nav>
  );
}

function buildPages(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('ellipsis');
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push('ellipsis');
  pages.push(total);
  return pages;
}
