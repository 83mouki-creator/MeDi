'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Camera, ImageUp, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { Button } from './ui/button';
import { Alert } from './ui/primitives';
import { formatFCFA, toFcfa } from '@/lib/utils';

type Match = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: string;
  promoPrice: string | null;
  onPromo: boolean;
  imageUrl: string | null;
  brandName: string | null;
  stock: number;
  reserved: number;
  score: number;
};

type Result =
  | { available: true; confident: boolean; calibrated: boolean; message: string; matches: Match[] }
  | { available: false; reason: string };

export function VisualSearch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  function handleFile(selected: File | undefined) {
    setError(null);
    setResult(null);
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      setError('Choisissez une image (JPEG, PNG, WebP).');
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError('Image trop lourde : 5 Mo maximum.');
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
  }

  async function analyse() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('image', file);
      const response = await fetch('/api/visual-search', { method: 'POST', body });
      const data = (await response.json()) as Result & { error?: string };

      if (!response.ok) {
        setError(data.error ?? (('reason' in data && data.reason) || 'Recherche impossible.'));
        return;
      }
      setResult(data as Result);
    } catch {
      setError('Connexion instable : la recherche n’a pas abouti. Réessayez.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-dashed border-navy-300 bg-white p-4 sm:p-6">
        {!preview ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-accent-50 text-accent-600">
              <Camera className="size-7" aria-hidden />
            </span>
            <div>
              <p className="font-semibold text-navy-900">Photographiez le produit</p>
              <p className="mt-1 text-sm text-navy-600">
                Cadrez l’objet sur fond neutre, avec une bonne lumière. La photo est comparée aux images du catalogue, puis
                supprimée : elle n’est ni conservée ni publiée.
              </p>
            </div>

            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={() => inputRef.current?.click()}>
                <Camera className="size-4" aria-hidden /> Prendre une photo
              </Button>
              <Button type="button" variant="outline" onClick={() => galleryRef.current?.click()}>
                <ImageUp className="size-4" aria-hidden /> Choisir une image
              </Button>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => handleFile(event.target.files?.[0])}
              aria-label="Prendre une photo avec la caméra"
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(event) => handleFile(event.target.files?.[0])}
              aria-label="Choisir une image dans la galerie"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative mx-auto max-w-sm overflow-hidden rounded-lg border border-navy-100 bg-navy-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Aperçu de la photo à analyser" className="aspect-square w-full object-contain" />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={analyse} loading={loading}>
                <Sparkles className="size-4" aria-hidden /> Lancer la recherche
              </Button>
              <Button type="button" variant="outline" onClick={reset} disabled={loading}>
                <RotateCcw className="size-4" aria-hidden /> Reprendre
              </Button>
            </div>
          </div>
        )}

        {error ? <Alert tone="danger" className="mt-3">{error}</Alert> : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-navy-100 bg-white p-6 text-sm text-navy-600">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Comparaison avec les photos du catalogue…
        </div>
      ) : null}

      {result && !loading ? (
        result.available === false ? (
          <Alert tone="warning" title="Recherche visuelle indisponible">{result.reason}</Alert>
        ) : (
          <div>
            <div className={`rounded-xl border p-4 ${result.confident ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <p className={`text-sm font-semibold ${result.confident ? 'text-emerald-900' : 'text-amber-900'}`}>{result.message}</p>
              {!result.confident ? (
                <p className="mt-1 text-xs text-amber-800">
                  Ces articles se ressemblent sur la photo, sans certitude qu’il s’agisse du même produit : vérifiez la référence,
                  les dimensions et la matière avant de commander.
                </p>
              ) : null}
            </div>

            {result.matches.length === 0 ? (
              <div className="mt-4 rounded-xl border border-navy-100 bg-white p-6 text-center text-sm text-navy-600">
                Aucun produit proche. Essayez une photo plus nette ou{' '}
                <Link href="/contact" className="font-semibold text-accent-700 underline">demandez-nous le produit</Link>.
              </div>
            ) : (
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {result.matches.map((match) => {
                  const available = match.stock - match.reserved;
                  return (
                    <li key={match.id} className="overflow-hidden rounded-xl border border-navy-100 bg-white">
                      <Link href={`/produit/${match.slug}`} className="block">
                        <div className="relative aspect-square bg-navy-50">
                          {match.imageUrl ? (
                            <Image src={match.imageUrl} alt={match.name} width={400} height={400} className="size-full object-cover" />
                          ) : null}
                          <span className="absolute right-2 top-2 rounded-md bg-navy-950/85 px-1.5 py-0.5 text-[11px] font-bold text-white">
                            {Math.round(match.score * 100)} %
                          </span>
                        </div>
                        <div className="p-2.5">
                          {match.brandName ? <p className="text-[10px] uppercase tracking-wide text-navy-400">{match.brandName}</p> : null}
                          <p className="line-clamp-2 text-sm font-semibold text-navy-900">{match.name}</p>
                          <p className="mt-1 text-sm font-extrabold">
                            {formatFCFA(match.onPromo ? toFcfa(match.price) : toFcfa(match.price))}
                          </p>
                          <p className={`text-[11px] ${available > 0 ? 'text-emerald-700' : 'text-danger-500'}`}>
                            {available > 0 ? `En stock (${available})` : 'Épuisé'}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            <button type="button" onClick={reset} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-navy-600 hover:text-accent-700">
              <X className="size-4" aria-hidden /> Nouvelle recherche
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}
