'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { inputClass } from './form';

/**
 * Champ mot de passe avec œil de visibilité.
 *
 * L'utilisateur — en particulier un agent qui recopie un mot de passe dicté au
 * téléphone — doit pouvoir relire sa saisie *avant* de valider. Le bouton est
 * accessible (aria-label + aria-pressed) et n'envoie jamais le formulaire.
 */
export function PasswordInput({
  className,
  revealLabel = 'Afficher le mot de passe',
  hideLabel = 'Masquer le mot de passe',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { revealLabel?: string; hideLabel?: string }) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn(inputClass, 'h-11 pr-11', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? hideLabel : revealLabel}
        aria-pressed={visible}
        title={visible ? hideLabel : revealLabel}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-navy-500 transition-colors hover:text-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-500"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M3 3l18 18" strokeLinecap="round" />
      <path d="M10.6 6.32A9.8 9.8 0 0 1 12 6.19c6 0 9.75 6.75 9.75 6.75s-1.06 1.9-3 3.7M6.5 8.1C4 9.9 2.25 12.94 2.25 12.94s3.75 6.75 9.75 6.75a9.7 9.7 0 0 0 4.2-.94" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" strokeLinecap="round" />
    </svg>
  );
}
