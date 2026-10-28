'use client';

import { useEffect } from 'react';
import { rememberProduct } from './recently-viewed';

export function TrackProductView({ productId }: { productId: string }) {
  useEffect(() => {
    rememberProduct(productId);
  }, [productId]);
  return null;
}
