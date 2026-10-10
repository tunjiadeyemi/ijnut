import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';

import appCss from '../styles.css?url';
import { NotFound } from '@/shared/components/NotFound';
import { ThemeProvider } from '@/shared/components/ThemeProvider';
import { ToastProvider } from '@/shared/components/ui/toast';
import { THEME_BOOT_SCRIPT } from '@/shared/lib/theme';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1'
      },
      {
        name: 'color-scheme',
        content: 'light dark'
      },
      { title: 'IJNUT' }
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap'
      },
      { rel: 'stylesheet', href: appCss }
    ],
    scripts: [
      {
        children: THEME_BOOT_SCRIPT
      }
    ]
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-svh overflow-x-hidden">
        <ThemeProvider>
          <ToastProvider>
            <div className="min-h-svh">{children}</div>
          </ToastProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
