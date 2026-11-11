// Markdown renderer for the temporary /kesiapanrilis page (tables via remark-gfm).
import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Md = ComponentProps<typeof ReactMarkdown>["components"];
const components: Md = {
  h1: (p) => <h1 className="font-display text-2xl font-extrabold text-navy sm:text-3xl" {...p} />,
  h2: (p) => <h2 className="mt-8 border-b border-border pb-2 font-display text-xl font-bold text-navy" {...p} />,
  h3: (p) => <h3 className="mt-6 font-display text-lg font-bold text-navy" {...p} />,
  p: (p) => <p className="mt-2 text-sm leading-relaxed text-foreground first:mt-0" {...p} />,
  ul: (p) => <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed" {...p} />,
  ol: (p) => <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed" {...p} />,
  a: (p) => <a className="font-semibold text-marine underline" target="_blank" rel="noreferrer" {...p} />,
  code: (p) => <code className="break-words rounded bg-muted px-1 py-0.5 font-mono text-[0.8em]" {...p} />,
  hr: () => <hr className="my-6 border-border" />,
  table: (p) => (
    <div className="mt-3 overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-sm" {...p} />
    </div>
  ),
  th: (p) => <th className="border-b border-border bg-muted/60 px-3 py-2 font-semibold text-navy" {...p} />,
  td: (p) => <td className="border-b border-border px-3 py-2 align-top" {...p} />,
};

export function ReleaseMarkdown({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children}</ReactMarkdown>;
}
