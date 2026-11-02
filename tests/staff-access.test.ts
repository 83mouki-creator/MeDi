import { describe, expect, it } from 'vitest';
import {
  formatStaffCodeInput,
  generateStaffCode,
  hashStaffCode,
  isValidStaffCodeShape,
  normalizeIvorianPhone,
  initials,
  staffInviteMessage,
  validateStaffPassword,
  whatsappDigits,
} from '@/lib/staff-access';
import { ROLES, assignableRoleDefinitions, roleDefinition, roleHome, roleLabel, rolePermissions } from '@/lib/roles';
import { assignableRoles } from '@/lib/auth';

describe('codes d’accès du personnel', () => {
  it('génère un code lisible au format MEDI-XXXX-XXXX-XXXX', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateStaffCode();
      expect(code).toMatch(/^MEDI(-[A-HJ-NP-Z2-9]{4}){3}$/);
      expect(isValidStaffCodeShape(code)).toBe(true);
      // Pas de caractères ambigus au téléphone.
      expect(code.slice(5)).not.toMatch(/[0O1IL]/);
    }
  });

  it('ne produit jamais deux fois le même code', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateStaffCode()));
    expect(codes.size).toBe(500);
  });

  it('ne stocke qu’un condensat, insensible à la casse et aux séparateurs', () => {
    const code = 'MEDI-7K4P-9QX2-W8MT';
    const hash = hashStaffCode(code);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('7K4P');
    expect(hashStaffCode(' medi 7k4p 9qx2 w8mt ')).toBe(hash);
    expect(hashStaffCode('MEDI-7K4P-9QX2-W8MZ')).not.toBe(hash);
  });

  it('remet en forme la saisie de l’agent', () => {
    expect(formatStaffCodeInput('medi7k4p9qx2w8mt')).toBe('MEDI-7K4P-9QX2-W8MT');
    expect(formatStaffCodeInput('MEDI')).toBe('MEDI');
    expect(isValidStaffCodeShape('MEDI-7K4P-9QX2')).toBe(false);
  });
});

describe('téléphone ivoirien', () => {
  it('accepte les écritures courantes et renvoie +225XXXXXXXXXX', () => {
    for (const input of ['07 08 90 48 91', '0708904891', '+225 07 08 90 48 91', '+2250708904891', '00225 0708904891', '  07.08.90.48.91 ']) {
      const result = normalizeIvorianPhone(input);
      expect(result.ok, input).toBe(true);
      if (result.ok) {
        expect(result.canonical).toBe('+2250708904891');
        expect(result.display).toBe('07 08 90 48 91');
      }
    }
  });

  it('accepte les fixes et les autres préfixes mobiles', () => {
    for (const input of ['21 30 45 67 89', '25 22 11 33 44', '27 20 00 11 22', '01 02 03 04 05', '+225 27 20 00 11 22']) {
      expect(normalizeIvorianPhone(input).ok, input).toBe(true);
    }
  });

  it('refuse un numéro vide, trop court ou étranger', () => {
    for (const input of ['', '   ', '07089048', '+33 6 12 34 56 78', 'abcdefghij', '+225 0 8 90 48 91']) {
      expect(normalizeIvorianPhone(input).ok, JSON.stringify(input)).toBe(false);
    }
  });

  it('convertit en numéro wa.me et garde l’indicatif', () => {
    const phone = normalizeIvorianPhone('07 08 90 48 91');
    expect(phone.ok && whatsappDigits(phone.canonical)).toBe('2250708904891');
  });
});

describe('mot de passe et messages du personnel', () => {
  it('impose 10 caractères, une lettre et un chiffre', () => {
    expect(validateStaffPassword('Court1', 'Court1')).not.toBeNull();
    expect(validateStaffPassword('motdepasse', 'motdepasse')).not.toBeNull();
    expect(validateStaffPassword('1234567890', '1234567890')).not.toBeNull();
    expect(validateStaffPassword('Caisse2026ok', 'Caisse2026oK')).not.toBeNull();
    expect(validateStaffPassword('Caisse2026ok', 'Caisse2026ok')).toBeNull();
  });

  it('compose un message WhatsApp contenant code, tâche et lien', () => {
    const message = staffInviteMessage({
      firstName: 'Awa',
      lastName: 'Koné',
      phone: '+2250708904891',
      code: 'MEDI-7K4P-9QX2-W8MT',
      roleLabel: 'Caissier',
      task: 'Caisse du matin',
      activationUrl: 'https://medi-daloa.vercel.app/connexion/agent',
      storeName: 'MeDi Daloa',
    });
    expect(message).toContain('MEDI-7K4P-9QX2-W8MT');
    expect(message).toContain('Caisse du matin');
    expect(message).toContain('https://medi-daloa.vercel.app/connexion/agent');
    expect(message).toContain('usage unique');
  });

  it('déduit des initiales lisibles', () => {
    expect(initials('Awa', 'Koné')).toBe('AK');
    expect(initials('', '')).toBe('—');
  });
});

describe('catalogue des rôles', () => {
  it('contient les 11 rôles internes et aucun doublon', () => {
    expect(ROLES).toHaveLength(11);
    expect(new Set(ROLES.map((role) => role.value)).size).toBe(11);
  });

  it('ajoute les 7 rôles du back-office quincaillerie', () => {
    for (const key of ['ACCOUNTANT', 'CASHIER', 'SALES_ADVISOR', 'WAREHOUSE_KEEPER', 'CATALOG_MANAGER', 'DELIVERY_MANAGER', 'SUPPORT_AGENT']) {
      const definition = roleDefinition(key);
      expect(definition, key).toBeTruthy();
      expect(definition!.label.length).toBeGreaterThan(2);
      expect(definition!.labelAr.length).toBeGreaterThan(2);
      expect(definition!.home.startsWith('/admin')).toBe(true);
    }
  });

  it('donne à chaque rôle un écran d’accueil autorisé', () => {
    for (const role of ROLES) {
      expect(roleHome(role.value)).toBe(role.home);
      expect(roleLabel(role.value)).toBe(role.label);
      expect(rolePermissions(role.value).length).toBeGreaterThan(0);
    }
    // Un rôle inconnu retombe sur l'accueil du back-office, jamais sur une page vide.
    expect(roleHome(null)).toBe('/admin');
    expect(roleLabel('ROLE_INEXISTANT')).toBe('ROLE_INEXISTANT');
  });

  it('ne propose à un administrateur que des rôles inférieurs au sien', () => {
    const keys = assignableRoleDefinitions(assignableRoles('ADMIN')).map((role) => role.value);
    expect(keys).not.toContain('ADMIN');
    expect(keys).not.toContain('OWNER');
    expect(keys).toContain('CASHIER');
    expect(assignableRoleDefinitions(['CASHIER']).length).toBe(1);
  });
});
