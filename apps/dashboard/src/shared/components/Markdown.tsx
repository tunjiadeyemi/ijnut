import ReactMarkdown from 'react-markdown';

type Props = {
  children: string;
  className?: string;
};

/** Compact markdown for AI replies — lists, code, emphasis; no raw HTML. */
export function Markdown({ children, className = '' }: Props) {
  return (
    <div className={`ai-md text-sm leading-relaxed ${className}`}>
      <ReactMarkdown
        components={{
          p: ({ children: c }) => <p className="mb-2 last:mb-0">{c}</p>,
          ul: ({ children: c }) => (
            <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{c}</ul>
          ),
          ol: ({ children: c }) => (
            <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{c}</ol>
          ),
          li: ({ children: c }) => <li className="leading-snug">{c}</li>,
          strong: ({ children: c }) => (
            <strong className="text-foreground font-semibold">{c}</strong>
          ),
          em: ({ children: c }) => <em className="italic">{c}</em>,
          a: ({ href, children: c }) => (
            <a
              href={href}
              className="text-primary underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              {c}
            </a>
          ),
          code: ({ className: cn, children: c }) => {
            const block = Boolean(cn?.includes('language-'));
            if (block) {
              return (
                <code className="font-mono text-[11px] leading-relaxed whitespace-pre">
                  {c}
                </code>
              );
            }
            return (
              <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">{c}</code>
            );
          },
          pre: ({ children: c }) => (
            <pre className="bg-muted mb-2 overflow-x-auto rounded-md px-2.5 py-2 last:mb-0">
              {c}
            </pre>
          ),
          h1: ({ children: c }) => (
            <p className="text-foreground mb-1.5 text-sm font-semibold">{c}</p>
          ),
          h2: ({ children: c }) => (
            <p className="text-foreground mb-1.5 text-sm font-semibold">{c}</p>
          ),
          h3: ({ children: c }) => (
            <p className="text-foreground mb-1 text-sm font-medium">{c}</p>
          ),
          blockquote: ({ children: c }) => (
            <blockquote className="border-border text-muted-foreground mb-2 border-l-2 pl-3">
              {c}
            </blockquote>
          ),
          hr: () => <hr className="border-border my-3" />
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
