import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogOut, MapPin, Package, User } from 'lucide-react';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { logoutAction } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';

const LINKS = [
  { href: '/compte', label: 'Vue d’ensemble', icon: User },
  { href: '/compte/commandes', label: 'Mes commandes', icon: Package },
  { href: '/compte/adresses', label: 'Mes adresses', icon: MapPin },
  { href: '/compte/infos', label: 'Mes informations', icon: User },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/connexion?redirectTo=/compte');

  return (
    <div className="container-page py-6">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">Mon compte</h1>
        <p className="text-sm text-navy-600">Connecté en tant que {user.firstName ?? user.email}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside>
          <nav aria-label="Navigation du compte" className="rounded-xl border border-navy-100 bg-white p-2">
            <ul className="space-y-0.5">
              {LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.href}>
                    <Link href={link.href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-navy-700 hover:bg-navy-50">
                      <Icon className="size-4 text-navy-400" aria-hidden />
                      {link.label}
                    </Link>
                  </li>
                );
              })}
              {isStaff(user.role) ? (
                <li>
                  <Link href="/admin" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-accent-700 hover:bg-accent-50">
                    Espace administration
                  </Link>
                </li>
              ) : null}
              <li className="border-t border-navy-100 pt-1">
                <form action={logoutAction}>
                  <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-navy-700 hover:bg-navy-50">
                    <LogOut className="size-4 text-navy-400" aria-hidden />
                    Se déconnecter
                  </button>
                </form>
              </li>
            </ul>
          </nav>
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
