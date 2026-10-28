'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Camera, Loader2, Search, X } from 'lucide-react';
import { cn, formatFCFA } from '@/lib/utils';

type Suggestion = {
  kind: 'product' | 'category' | 'brand';
  label: string;
  href: string;
  imageUrl?: string | null;
  price?: string | null;
};

const KIND_LABEL: Record<Suggestion['kind'], string> = {
  product: 'Produit',
  category: 'Catégorie',
  brand: 'Marque',
};

/** Barre de recherche centrale, accessible sur toutes les pages, avec suggestions. */
export function SearchBar({ initialQuery = '', className, autoFocus }: { initialQuery?: string; className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const controller = new AbortController();
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as { suggestions: Suggestion[] };
        setSuggestions(data.suggestions ?? []);
        setOpen(true);
      } catch {
        /* requête annulée ou réseau lent : on ignore silencieusement */
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function submit(value = query) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setOpen(false);
    router.push(`/catalogue?q=${encodeURIComponent(trimmed)}`);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
      setOpen(true);
    } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const active = suggestions[activeIndex];
      if (open && active) {
        setOpen(false);
        router.push(active.href);
      } else {
        submit();
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex items-stretch overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-navy-200 focus-within:ring-2 focus-within:ring-accent-400"
      >
        <label htmlFor={`${listId}-input`} className="sr-only">
          Rechercher un produit, une marque ou une référence
        </label>
        <input
          id={`${listId}-input`}
          type="search"
          inputMode="search"
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Perceuse, ciment, Nasco, ventilateur…"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-navy-950 outline-none placeholder:text-navy-400"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSuggestions([]);
            }}
            className="px-2 text-navy-400 hover:text-navy-700"
            aria-label="Effacer la recherche"
          >
            <X className="size-4" />
          </button>
        ) : null}
        <Link
          href="/recherche-visuelle"
          className="hidden items-center gap-1.5 border-l border-navy-100 px-3 text-xs font-semibold text-navy-700 hover:bg-navy-50 sm:flex"
          title="Rechercher par photo"
        >
          <Camera className="size-4 text-accent-600" />
          <span className="hidden lg:inline">Par photo</span>
        </Link>
        <button
          type="submit"
          className="flex items-center gap-2 bg-accent-500 px-4 text-sm font-semibold text-white hover:bg-accent-600"
        >
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
          <span className="hidden sm:inline">Rechercher</span>
        </button>
      </form>

      {open && (query.trim().length >= 2) ? (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-navy-100 bg-white shadow-xl">
          {suggestions.length === 0 && !loading ? (
            <p className="px-4 py-3 text-sm text-navy-500">Aucune suggestion. Lancez la recherche complète.</p>
          ) : (
            <ul id={listId} role="listbox" className="max-h-[22rem] overflow-y-auto py-1">
              {suggestions.map((suggestion, index) => (
                <li
                  key={`${suggestion.kind}-${suggestion.href}-${index}`}
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <Link
                    href={suggestion.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-navy-50',
                      index === activeIndex && 'bg-navy-50',
                    )}
                  >
                    {suggestion.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={suggestion.imageUrl} alt="" className="size-9 rounded-md object-cover" loading="lazy" />
                    ) : (
                      <span className="grid size-9 place-items-center rounded-md bg-navy-100 text-[10px] font-bold text-navy-500">
                        {KIND_LABEL[suggestion.kind].slice(0, 3).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-navy-900">{suggestion.label}</span>
                      <span className="block text-xs text-navy-400">{KIND_LABEL[suggestion.kind]}</span>
                    </span>
                    {suggestion.price ? (
                      <span className="text-xs font-semibold text-navy-800">{formatFCFA(Number(suggestion.price))}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => submit()}
            className="flex w-full items-center gap-2 border-t border-navy-100 bg-navy-50 px-4 py-2.5 text-left text-sm font-semibold text-accent-700 hover:bg-navy-100"
          >
            <Search className="size-4" aria-hidden />
            Voir tous les résultats pour « {query.trim()} »
          </button>
        </div>
      ) : null}
    </div>
  );
}
