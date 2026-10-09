import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, KeyRound } from 'lucide-react';
import { Link, useNavigate } from '@tanstack/react-router';

import { authClient } from '@/features/auth/client';

import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

type Mode = 'signin' | 'signup' | 'forgot';

export function LoginPage({ githubConfigured }: { githubConfigured: boolean }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setPending(true);
    try {
      if (mode === 'forgot') {
        const { error: err } = await authClient.requestPasswordReset({
          email,
          redirectTo: '/reset-password'
        });
        if (err) {
          setError(err.message || 'Could not send reset email');
          return;
        }
        setInfo('If that email exists, a reset link was sent (check server logs in dev).');
        return;
      }

      if (mode === 'signup') {
        const { error: err } = await authClient.signUp.email({
          name: name.trim() || email.split('@')[0] || 'User',
          email,
          password
        });
        if (err) {
          setError(err.message || 'Could not create account');
          return;
        }
      } else {
        const { error: err } = await authClient.signIn.email({ email, password });
        if (err) {
          setError(err.message || 'Could not sign in');
          return;
        }
      }

      await navigate({ to: '/' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPending(false);
    }
  }

  async function onGithub() {
    setError(null);
    setPending(true);
    try {
      await authClient.signIn.social({
        provider: 'github',
        callbackURL: '/'
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GitHub sign-in failed');
      setPending(false);
    }
  }

  const title =
    mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'Sign in';

  return (
    <div className="relative mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-3 py-8 sm:px-4 sm:py-10">
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
        <ThemeToggle compact />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full space-y-6"
      >
        <div className="space-y-2 text-center">
          <Link to="/" className="text-xl font-semibold tracking-tight sm:text-2xl">
            IJNUT
          </Link>
          <p className="text-muted-foreground text-sm">
            Metrics stay open. Sign in for Cloud AI.
          </p>
        </div>

        <Card>
          <CardHeader className="px-4 pt-4 sm:px-5 sm:pt-5">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" />
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {info ? (
              <Alert>
                <AlertDescription>{info}</AlertDescription>
              </Alert>
            ) : null}

            {githubConfigured && mode !== 'forgot' ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={() => void onGithub()}
              >
                <span className="font-semibold" aria-hidden>
                  GH
                </span>
                Continue with GitHub
              </Button>
            ) : null}

            {githubConfigured && mode !== 'forgot' ? (
              <p className="text-muted-foreground text-center text-xs">or email</p>
            ) : null}

            <form onSubmit={onSubmit} className="space-y-4">
              {mode === 'signup' ? (
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {mode !== 'forgot' ? (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              ) : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? (
                  <Loader2 className="animate-spin" />
                ) : mode === 'forgot' ? (
                  'Send reset link'
                ) : mode === 'signup' ? (
                  'Create account'
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            <div className="text-muted-foreground flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
              {mode === 'signin' ? (
                <>
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => {
                      setMode('signup');
                      setError(null);
                      setInfo(null);
                    }}
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                      setInfo(null);
                    }}
                  >
                    Forgot password?
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                    setInfo(null);
                  }}
                >
                  Back to sign in
                </button>
              )}
              <Link to="/" className="underline-offset-2 hover:underline">
                Continue as guest
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
