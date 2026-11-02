import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ACTION_CATEGORIES,
  ACTIVITY_CATEGORIES,
  actionsForCategory,
  categoryOf,
  dayGroup,
  describeActivity,
  describeWhen,
  technicalSummary,
} from '@/lib/activity';
import { translate } from '@/lib/i18n/admin';
import { ORDER_STEPS, ORDER_STATUS_ACTIONS, orderStep } from '@/lib/order-status';

/** Toutes les phrases-gabarits écrites dans le module. */
function templateKeys(): string[] {
  const source = readFileSync('src/lib/activity.ts', 'utf8');
  const keys = new Set<string>();
  for (const match of source.matchAll(/key:\s*'((?:\\.|[^'])*)'/g)) keys.add(match[1]!);
  for (const match of source.matchAll(/key:\s*"((?:\\.|[^"])*)"/g)) keys.add(match[1]!);
  return [...keys];
}

describe('journal expliqué', () => {
  it('donne une phrase à chaque action connue, sans code technique', () => {
    for (const action of Object.keys(ACTION_CATEGORIES)) {
      const description = describeActivity(action, {}, {});
      expect(description.category, action).not.toBe('autre');
      expect(description.title.key.length).toBeGreaterThan(5);
      // Aucun code technique (`product.updated`) ne doit apparaître dans la phrase.
      expect(description.title.key).not.toMatch(/[a-z]+\.[a-z_]+/);
      expect(description.title.key).not.toContain('_');
    }
  });

  it('reste lisible pour une action inconnue', () => {
    const description = describeActivity('quelque.chose_denouveau', { foo: 'bar' });
    expect(description.category).toBe('autre');
    expect(description.title.key).toBe('Une action a été enregistrée');
    expect(description.detail?.key).toContain('{code}');
  });

  it('remplit les phrases avec les noms lisibles', () => {
    const deleted = describeActivity('product.archived', {}, { product: 'Perceuse Bosch' });
    expect(deleted.title.vars?.produit).toBe('Perceuse Bosch');
    expect(deleted.category).toBe('produits');

    const paid = describeActivity('payment.confirmed', {}, { order: 'MED-0001' });
    expect(paid.title.vars?.commande).toBe('MED-0001');
    expect(paid.tone).toBe('success');

    const stock = describeActivity('stock.adjusted', { mode: 'delta', quantity: -3, reason: 'Casse' }, { product: 'Marteau' });
    expect(String(stock.detail?.vars?.mouvement)).toContain('3');
    expect(stock.tone).toBe('warning');

    const staff = describeActivity('staff.created', { role: 'CASHIER', task: 'Caisse du matin' }, { user: 'Awa Koné' });
    expect(staff.title.vars?.agent).toBe('Awa Koné');
    expect(staff.detail?.translate).toContain('role');
  });

  it('range chaque action dans une catégorie filtrable', () => {
    expect(categoryOf('order.created')).toBe('commandes');
    expect(categoryOf('payment.confirmed')).toBe('paiements');
    expect(categoryOf('stock.adjusted')).toBe('stock');
    expect(categoryOf('inconnu')).toBe('autre');
    expect(actionsForCategory('paiements')).toContain('payment.confirmed');
    expect(actionsForCategory(undefined)).toEqual([]);
  });

  it('écrit les heures comme un humain', () => {
    const now = new Date(2026, 10, 2, 15, 30);
    expect(describeWhen(new Date(2026, 10, 2, 15, 29, 40), now).key).toBe('à l’instant');
    expect(describeWhen(new Date(2026, 10, 2, 15, 5), now)).toEqual({ key: 'il y a {minutes} min', vars: { minutes: 25 } });
    expect(describeWhen(new Date(2026, 10, 2, 9, 5), now)).toEqual({ key: 'aujourd’hui à {heure}', vars: { heure: '09:05' } });
    expect(describeWhen(new Date(2026, 10, 1, 18, 0), now)).toEqual({ key: 'hier à {heure}', vars: { heure: '18:00' } });
    expect(describeWhen(new Date(2026, 9, 30, 10, 0), now)).toEqual({ key: 'il y a {jours} jours', vars: { jours: 3 } });
    expect(describeWhen(new Date(2026, 8, 12, 8, 7), now)).toEqual({ key: 'le {date} à {heure}', vars: { date: '12/09/2026', heure: '08:07' } });

    expect(dayGroup(new Date(2026, 10, 2, 0, 1), now)).toBe('aujourdhui');
    expect(dayGroup(new Date(2026, 10, 1, 23, 59), now)).toBe('hier');
    expect(dayGroup(new Date(2026, 9, 20), now)).toBe('plus-tot');
  });

  it('résume la ligne technique en une seule ligne courte', () => {
    expect(technicalSummary('product.updated', 'product', 'prd_123')).toBe('product.updated · product · prd_123');
    expect(technicalSummary('settings.updated', null, null)).toBe('settings.updated');
  });
});

describe('progression d’une commande', () => {
  it('range les onze statuts sur quatre étapes', () => {
    expect(orderStep('PENDING_CONFIRMATION')).toBe(0);
    expect(orderStep('AWAITING_PAYMENT')).toBe(0);
    expect(orderStep('AWAITING_PAYMENT_VERIFICATION')).toBe(0);
    expect(orderStep('PAYMENT_CONFIRMED')).toBe(1);
    expect(orderStep('PREPARING')).toBe(1);
    expect(orderStep('READY_TO_SHIP')).toBe(2);
    expect(orderStep('SHIPPED')).toBe(2);
    expect(orderStep('OUT_FOR_DELIVERY')).toBe(2);
    expect(orderStep('DELIVERED')).toBe(3);
    expect(ORDER_STEPS).toHaveLength(4);
  });

  it('décrit chaque étape comme une action, sans jargon', () => {
    for (const label of Object.values(ORDER_STATUS_ACTIONS)) {
      expect(label).not.toMatch(/_/);
      expect(label.split(' ').length).toBeGreaterThan(1);
    }
  });
});

describe('traductions du journal', () => {
  it('chaque phrase du journal existe en arabe', () => {
    // Les clés de catégorie (`key: 'commandes'`) ne sont pas des phrases, et
    // `{mouvement}{motif}` ne contient que des variables : rien à traduire.
    const variableOnly = new Set(['{mouvement}{motif}']);
    const missing = templateKeys()
      .filter((key) => !/^[a-z]+$/.test(key))
      .filter((key) => !variableOnly.has(key))
      .filter((key) => translate('ar', key) === key);
    expect(missing, `Phrases sans traduction : ${missing.join(' | ')}`).toEqual([]);
  });

  it('les catégories du filtre sont traduites aussi', () => {
    for (const category of ACTIVITY_CATEGORIES) {
      expect(translate('ar', category.label), category.label).not.toBe(category.label);
    }
  });

  it('les valeurs de statut insérées dans les phrases sont traduites', () => {
    for (const label of ['Paiement confirmé', 'En préparation', 'Livrée', 'Annulée', 'nouveau message', 'message traité', 'autorisé', 'désactivé']) {
      expect(translate('ar', label), label).not.toBe(label);
    }
  });
});
