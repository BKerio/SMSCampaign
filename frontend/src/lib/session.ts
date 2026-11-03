import { notify, signOutDialog } from '@/lib/alert';

export async function confirmAndSignOut(
  user: { name?: string | null; email?: string | null } | null,
  logout: () => void,
  navigate: (path: string) => void,
): Promise<void> {
  const confirmed = await signOutDialog(user);
  if (!confirmed) return;

  notify('success', 'Signed out', "You've been signed out of your workspace.");
  logout();
  navigate('/login');
}
