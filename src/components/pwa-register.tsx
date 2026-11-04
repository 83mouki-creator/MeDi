'use client';

import { useEffect } from 'react';

/**
 * Enregistre le service worker (`public/sw.js`).
 *
 * Sans lui, le site fonctionne normalement mais l'application Android n'a pas de
 * page « pas de connexion » et les images ne sont pas gardées en cache.
 * Le montage est silencieux : en cas d'échec (navigation privée, vieux
 * navigateur), la boutique continue de fonctionner.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
