import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { ToastProvider } from "@/components/ui/toast";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "IJNUT" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="h-svh max-h-svh overflow-hidden">
        <ToastProvider>
          <div className="h-svh max-h-svh overflow-hidden">{children}</div>
        </ToastProvider>
        <Scripts />
      </body>
    </html>
  );
}
