import { ProductCardSkeleton } from '@/components/product-card';

export default function Loading() {
  return (
    <div className="container-page py-6" aria-busy="true" aria-live="polite">
      <div className="mb-6 h-8 w-64 animate-pulse rounded bg-navy-100" />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="hidden h-96 animate-pulse rounded-xl bg-white lg:block" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
