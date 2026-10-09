import { createFileRoute, redirect } from '@tanstack/react-router';

import { LoginPage } from '@/features/auth/components/LoginPage';
import { getAuthState } from '@/features/auth/functions';

export const Route = createFileRoute('/login')({
  component: LoginRoute,
  beforeLoad: async () => {
    const state = await getAuthState();
    if (state.authenticated) {
      throw redirect({ to: '/' });
    }
    return { githubConfigured: state.githubConfigured };
  }
});

function LoginRoute() {
  const { githubConfigured } = Route.useRouteContext();
  return <LoginPage githubConfigured={githubConfigured} />;
}
