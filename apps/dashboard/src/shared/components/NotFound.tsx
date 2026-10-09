import { Link } from '@tanstack/react-router';
import { Button } from '@/shared/components/ui/button';

export function NotFound() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        That route does not exist. Head back to the dashboard.
      </p>
      <Button asChild variant="default">
        <Link to="/">Go home</Link>
      </Button>
    </div>
  );
}
