import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import sharp from 'sharp';

/**
 * Contrôles des éléments déposés sur Google Play : textes de la fiche, manifeste
 * Bubblewrap, bannière et workflow de compilation.
 *
 * Ces fichiers ne servent pas au site, mais une erreur ici coûte un refus de la
 * Play Console — donc un aller-retour de plusieurs jours. Les règles testées sont
 * celles de Google (longueurs, formats d'image) et les choix arrêtés avec le
 * propriétaire (nom, package, couleurs).
 */

const listing = JSON.parse(readFileSync('store/play-listing.json', 'utf8')) as {
  language: string;
  appName: string;
  shortDescription: string;
  fullDescription: string;
  releaseNotes: string;
  category: string;
  contact: { email: string; phone: string; website: string };
  privacyPolicyUrl: string;
  accountDeletionUrl: string;
};

const twa = JSON.parse(readFileSync('android/twa-manifest.json', 'utf8')) as Record<string, unknown>;

const GUIDE = readFileSync('docs/PLAY-STORE.md', 'utf8');

describe('fiche Play Store — textes', () => {
  it('respecte les longueurs imposées par Google', () => {
    expect(listing.appName.length, 'nom (30 max)').toBeLessThanOrEqual(30);
    expect(listing.shortDescription.length, 'description courte (80 max)').toBeLessThanOrEqual(80);
    expect(listing.shortDescription.length, 'description courte trop courte').toBeGreaterThan(20);
    expect(listing.fullDescription.length, 'description complète (4 000 max)').toBeLessThanOrEqual(4000);
    expect(listing.fullDescription.length, 'description complète trop courte').toBeGreaterThan(500);
    expect(listing.releaseNotes.length, 'nouveautés (500 max)').toBeLessThanOrEqual(500);
  });

  it('porte l’enseigne Perokado, jamais l’ancien nom', () => {
    for (const texte of [listing.appName, listing.shortDescription, listing.fullDescription, listing.releaseNotes]) {
      expect(texte).not.toMatch(/MeDi/i);
    }
    expect(listing.appName).toBe('Perokado');
  });

  it('ne promet ni retrait en magasin ni multilingue : le parcours a changé', () => {
    for (const texte of [listing.shortDescription, listing.fullDescription, listing.releaseNotes]) {
      expect(texte).not.toMatch(/retrait en boutique|Retrait en boutique/i);
      expect(texte).not.toMatch(/arabe|anglais/i);
      expect(texte).not.toMatch(/GPS/);
    }
  });

  it('parle français et donne les bonnes adresses', () => {
    expect(listing.language).toBe('fr-FR');
    expect(listing.category).toBe('Shopping');
    expect(listing.privacyPolicyUrl).toBe('https://perokado.vercel.app/confidentialite');
    // Adresse exigée par Google pour la suppression de compte.
    expect(listing.accountDeletionUrl).toBe('https://perokado.vercel.app/supprimer-mon-compte');
    expect(listing.contact.website).toBe('https://perokado.vercel.app');
  });

  it('ne publie aucune donnée inventée pour les contacts', () => {
    // Les coordonnées viennent des réglages de la boutique : tant qu'elles ne
    // sont pas saisies ici, le fichier doit le dire explicitement.
    for (const valeur of [listing.contact.email, listing.contact.phone]) {
      const marque = valeur.startsWith('à compléter');
      const plausible = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur) || /^\+?\d[\d\s]{7,}$/.test(valeur);
      expect(marque || plausible, `valeur douteuse : ${valeur}`).toBe(true);
    }
  });

  it('reste identique au texte reproduit dans le guide', () => {
    expect(GUIDE).toContain(listing.shortDescription);
    expect(GUIDE).toContain(listing.fullDescription);
    expect(GUIDE).toContain(listing.releaseNotes);
  });
});

describe('manifeste Bubblewrap (Android)', () => {
  it('décrit le bon site, le bon nom et le bon package', () => {
    expect(twa.packageId).toBe('ci.perokado.app');
    expect(twa.host).toBe('perokado.vercel.app');
    expect(twa.name).toBe('Perokado');
    expect(twa.launcherName).toBe('Perokado');
    expect(twa.webManifestUrl).toBe('https://perokado.vercel.app/manifest.webmanifest');
    expect(twa.startUrl).toBe('/');
  });

  it('s’ouvre en plein écran, en portrait, aux couleurs de la boutique', () => {
    expect(twa.display).toBe('standalone');
    expect(twa.orientation).toBe('portrait');
    // Bleu nuit de la charte Perokado.
    for (const cle of ['themeColor', 'themeColorDark', 'navigationColor', 'backgroundColor']) {
      expect(twa[cle], cle).toBe('#0E2340');
    }
  });

  it('utilise les icônes réellement publiées sur le site', () => {
    expect(twa.iconUrl).toBe('https://perokado.vercel.app/brand/perokado-icon.png');
    expect(twa.maskableIconUrl).toBe('https://perokado.vercel.app/brand/perokado-icon-maskable-512.png');
    expect(existsSync('public/brand/perokado-icon.png')).toBe(true);
    expect(existsSync('public/brand/perokado-icon-maskable-512.png')).toBe(true);
  });

  it('garde trois raccourcis vers des adresses absolues', () => {
    const shortcuts = twa.shortcuts as { name: string; url: string }[];
    expect(shortcuts).toHaveLength(3);
    for (const raccourci of shortcuts) {
      expect(raccourci.url.startsWith('https://perokado.vercel.app/')).toBe(true);
    }
  });

  it('prévoit une version croissante et la clé de signature « perokado »', () => {
    expect(Number.isInteger(twa.appVersionCode)).toBe(true);
    expect(twa.appVersionCode as number).toBeGreaterThanOrEqual(1);
    expect(typeof twa.appVersionName).toBe('string');
    const signature = twa.signingKey as { path: string; alias: string };
    expect(signature.alias).toBe('perokado');
    // La clé elle-même n'est jamais versionnée : seuls les secrets GitHub la portent.
    expect(existsSync('android.keystore')).toBe(false);
  });
});

describe('visuels Play Store', () => {
  it('fournit une bannière 1024 × 500 sans transparence', async () => {
    const fichier = 'public/brand/play-feature-graphic.png';
    expect(existsSync(fichier)).toBe(true);
    const info = await sharp(fichier).metadata();
    expect(info.width).toBe(1024);
    expect(info.height).toBe(500);
    expect(info.hasAlpha, 'Google refuse les images transparentes').toBe(false);
    expect(statSync(fichier).size).toBeLessThan(15 * 1024 * 1024);
  });

  it('fournit une icône 512 × 512', async () => {
    const info = await sharp('public/brand/perokado-icon.png').metadata();
    expect(info.width).toBe(512);
    expect(info.height).toBe(512);
    expect(statSync('public/brand/perokado-icon.png').size).toBeLessThan(1024 * 1024);
  });
});

describe('workflow GitHub Actions', () => {
  const workflow = readFileSync('.github/workflows/android-aab.yml', 'utf8');

  it('compile l’AAB signé depuis le manifeste versionné', () => {
    expect(workflow).toContain('bubblewrap update');
    expect(workflow).toContain('bubblewrap build --skipPwaValidation');
    expect(workflow).toContain('--manifest ./android/twa-manifest.json');
    expect(workflow).toContain('--signingKeyAlias perokado');
  });

  it('lit la clé et les mots de passe dans les secrets, jamais dans le dépôt', () => {
    expect(workflow).toContain('secrets.ANDROID_KEYSTORE_BASE64');
    expect(workflow).toContain('secrets.KEYSTORE_PASSWORD');
    expect(workflow).toContain('secrets.KEY_PASSWORD');
    // Bubblewrap attend ces deux variables d'environnement : sans elles, il pose
    // une question interactive et le workflow se bloquerait.
    expect(workflow).toContain('BUBBLEWRAP_KEYSTORE_PASSWORD');
    expect(workflow).toContain('BUBBLEWRAP_KEY_PASSWORD');
  });

  it('publie les fichiers à télécharger', () => {
    expect(workflow).toContain('actions/upload-artifact');
    expect(workflow).toContain('android/app-release-bundle.aab');
    expect(workflow).toContain('android/app-release-signed.apk');
  });
});
