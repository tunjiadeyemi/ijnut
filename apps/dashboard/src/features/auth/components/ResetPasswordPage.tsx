import { useState } from 'react';
import { Loader2, KeyRound } from 'lucide-react';
import { Link, useNavigate } from '@tanstack/react-router';

import { authClient } from '@/features/auth/client';

import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

export function ResetPasswordPage({ token }: { token: string }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!token) {
      setError('Missing reset token. Open the link from your email again.');
      return;
    }
    setPending(true);
    try {
      const { error: err } = await authClient.resetPassword({
        newPassword: password,
        token
      });
      if (err) {
        setError(err.message || 'Could not reset password');
        return;
      }
      await navigate({ to: '/login' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-3 py-8 sm:px-4 sm:py-10">
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
        <ThemeToggle compact />
      </div>
      <div className="w-full space-y-6">
        <div className="space-y-2 text-center">
          <Link to="/" className="text-xl font-semibold tracking-tight sm:text-2xl">
            IJNUT
          </Link>
        </div>
        <Card>
          <CardHeader className="px-4 pt-4 sm:px-5 sm:pt-5">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" />
              New password
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
            {error ? (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : 'Update password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
