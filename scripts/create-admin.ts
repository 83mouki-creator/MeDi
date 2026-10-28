/**
 * Création d'un compte administrateur MeDi.
 *
 * Aucun compte administrateur n'est créé par les migrations, et aucun mot de passe
 * par défaut n'existe. Le mot de passe est saisi en interactif (ou fourni par
 * variable d'environnement pour un pipeline), puis haché en scrypt.
 *
 *   npm run admin:create
 *   npm run admin:create -- --email=owner@exemple.ci --role=OWNER --name="Direction"
 *
 * Variables acceptées : MEDI_ADMIN_EMAIL, MEDI_ADMIN_PASSWORD, MEDI_ADMIN_ROLE,
 * MEDI_ADMIN_NAME (sinon questions interactives).
 */
import { createInterface } from 'node:readline/promises';
import { randomBytes, scryptSync } from 'node:crypto';
import { stdin, stdout } from 'node:process';
import { eq, sql } from 'drizzle-orm';
import { db, pool } from '../src/db';
import { users } from '../src/db/schema';
import { newId } from '../src/lib/utils';
import { audit } from '../src/lib/audit';

const ROLES = ['OWNER', 'ADMIN', 'STOCK_MANAGER', 'ORDER_MANAGER'] as const;
type Role = (typeof ROLES)[number];

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

/** scrypt au format `scrypt$N$r$p$salt$hash` (compatible src/lib/auth.ts). */
function hashPassword(password: string): string {
  const N = 16384;
  const r = 8;
  const p = 1;
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize('NFKC'), salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 12) problems.push('au moins 12 caractères');
  if (!/[a-z]/.test(password)) problems.push('une minuscule');
  if (!/[A-Z]/.test(password)) problems.push('une majuscule');
  if (!/[0-9]/.test(password)) problems.push('un chiffre');
  if (!/[^A-Za-z0-9]/.test(password)) problems.push('un caractère spécial');
  if (/(password|motdepasse|123456|azerty|qwerty)/i.test(password)) problems.push('pas de mot de passe évident');
  return problems;
}

async function main() {
  const interactive = stdin.isTTY && !process.env.MEDI_ADMIN_PASSWORD && !arg('password');
  const rl = interactive ? createInterface({ input: stdin, output: stdout }) : null;

  try {
    const email = (arg('email') ?? process.env.MEDI_ADMIN_EMAIL ?? (await rl?.question('Adresse e-mail : ')) ?? '')
      .trim()
      .toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
      throw new Error('Adresse e-mail invalide.');
    }

    const roleInput = (arg('role') ?? process.env.MEDI_ADMIN_ROLE ?? (await rl?.question(`Rôle (${ROLES.join('/')}) [OWNER] : `)) ?? 'OWNER')
      .trim()
      .toUpperCase();
    const role = (ROLES.includes(roleInput as Role) ? roleInput : 'OWNER') as Role;

    const name = (arg('name') ?? process.env.MEDI_ADMIN_NAME ?? (await rl?.question('Nom affiché (optionnel) : ')) ?? '').trim();

    let password = arg('password') ?? process.env.MEDI_ADMIN_PASSWORD ?? '';
    if (!password && rl) {
      password = await rl.question('Mot de passe (12+ caractères, non affiché) : ');
      const confirm = await rl.question('Confirmer le mot de passe : ');
      if (password !== confirm) throw new Error('Les mots de passe ne correspondent pas.');
    }

    const problems = passwordProblems(password);
    if (problems.length) {
      throw new Error(`Mot de passe refusé : il faut ${problems.join(', ')}.`);
    }

    const existing = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      console.log(`ℹ️  ${email} existe déjà (rôle ${existing[0].role}). Mise à jour du mot de passe et du rôle.`);
      await db
        .update(users)
        .set({
          passwordHash: hashPassword(password),
          role,
          isActive: true,
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing[0].id));
    } else {
      const [first, ...rest] = name.split(/\s+/);
      await db.insert(users).values({
        id: newId('usr_'),
        email,
        passwordHash: hashPassword(password),
        firstName: first || null,
        lastName: rest.join(' ') || null,
        role,
        isActive: true,
      });
    }

    await audit(null, {
      action: 'USER_UPSERTED',
      entity: 'user',
      metadata: { email, role, via: 'scripts/create-admin.ts' },
    });

    // Vérifie que le hash relu est bien au format attendu par verifyPassword().
    const check = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.email, email)).limit(1);
    if (!check[0]?.hash.startsWith('scrypt$')) throw new Error('Le hash enregistré est invalide.');

    console.log(`✅ Compte ${role} prêt : ${email}`);
    console.log('   Connexion : /connexion — espace d’administration : /admin');
    console.log('   Aucun mot de passe n’est stocké en clair ; conservez-le dans un gestionnaire de secrets.');
  } finally {
    rl?.close();
    await db.execute(sql`select 1`).catch(() => undefined);
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
