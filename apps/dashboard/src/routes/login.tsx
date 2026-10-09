import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginPage } from '@/features/auth/components/LoginPage';
import { getAuthState } from '@/features/auth/functions';

export const Route = createFileRoute('/login')({
  component: LoginPage,
  beforeLoad: async () => {
    const { authenticated } = await getAuthState();
    if (authenticated) {
      throw redirect({ to: '/' });
    }
  }
});
