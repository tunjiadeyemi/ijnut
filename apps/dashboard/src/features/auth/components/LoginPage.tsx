import { useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Loader2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

import { loginWithAdminKey } from '@/features/auth/functions';

import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

export function LoginPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await loginWithAdminKey({ data: { token } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await navigate({ to: '/' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-3 py-8 sm:px-4 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full space-y-6"
      >
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">IJNUT</h1>
        </div>

        <Card>
          <CardHeader className="px-4 pt-4 sm:px-5 sm:pt-5">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" />
              Sign in
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
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : 'Continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
