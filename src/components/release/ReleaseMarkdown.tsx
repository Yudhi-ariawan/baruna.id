// Markdown renderer for the temporary /kesiapanrilis page (tables via remark-gfm,
// ```mermaid blocks as diagrams, in-page links to `<a id>` anchors before headings).
import { isValidElement, useMemo, type ComponentProps, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "./MermaidDiagram";

type Md = NonNullable<ComponentProps<typeof ReactMarkdown>["components"]>;

/** `<a id="x"></a>` lines before a heading become that heading's id (raw HTML is not rendered). */
function extractAnchors(markdown: string) {
  const ids = new Map<string, string>();
  const md = markdown.replace(/<a id="([^"]+)"><\/a>\s*\n+(#{1,6}) ([^\n]+)/g, (_m, id: string, hashes: string, text: string) => {
    ids.set(plainText(text), id);
    return `${hashes} ${text}`;
  });
  return { md, ids };
}
function plainText(text: string) {
  return text.replace(/[`*_]/g, "").trim();
}
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}
function codeChild(children: ReactNode): { className: string; text: string } | null {
  const child = Array.isArray(children) ? children[0] : children;
  if (!isValidElement(child)) return null;
  const props = child.props as { className?: string; children?: ReactNode };
  return { className: props.className ?? "", text: textOf(props.children) };
}

function buildComponents(ids: Map<string, string>): Md {
  const idFor = (children: ReactNode) => ids.get(plainText(textOf(children)));
  return {
    h1: ({ node: _n, ...p }) => <h1 className="font-display text-2xl font-extrabold text-navy sm:text-3xl" {...p} />,
    h2: ({ node: _n, ...p }) => <h2 id={idFor(p.children)} className="mt-8 scroll-mt-4 border-b border-border pb-2 font-display text-xl font-bold text-navy" {...p} />,
    h3: ({ node: _n, ...p }) => <h3 id={idFor(p.children)} className="mt-6 scroll-mt-4 font-display text-lg font-bold text-navy" {...p} />,
    p: ({ node: _n, ...p }) => <p className="mt-2 text-sm leading-relaxed text-foreground first:mt-0" {...p} />,
    ul: ({ node: _n, ...p }) => <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed" {...p} />,
    ol: ({ node: _n, ...p }) => <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed" {...p} />,
    a: ({ node: _n, href, ...p }) =>
      href?.startsWith("#") ? (
        <a href={href} className="font-semibold text-marine underline"
          onClick={(e) => {
            const el = document.getElementById(decodeURIComponent(href.slice(1)));
            if (el) { e.preventDefault(); el.scrollIntoView({ behavior: "smooth", block: "start" }); }
          }} {...p} />
      ) : (
        <a href={href} className="font-semibold text-marine underline" target="_blank" rel="noreferrer" {...p} />
      ),
    code: ({ node: _n, ...p }) => <code className="break-words rounded bg-muted px-1 py-0.5 font-mono text-[0.8em]" {...p} />,
    pre: ({ node: _n, children, ...p }) => {
      const code = codeChild(children);
      if (code && /\blanguage-mermaid\b/.test(code.className)) return <MermaidDiagram code={code.text.replace(/\n$/, "")} />;
      return <pre className="mt-3 overflow-x-auto rounded-xl bg-muted p-3 text-xs" {...p}>{children}</pre>;
    },
    hr: () => <hr className="my-6 border-border" />,
    table: ({ node: _n, ...p }) => (
      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-left text-sm" {...p} />
      </div>
    ),
    th: ({ node: _n, ...p }) => <th className="border-b border-border bg-muted/60 px-3 py-2 font-semibold text-navy" {...p} />,
    td: ({ node: _n, ...p }) => <td className="border-b border-border px-3 py-2 align-top" {...p} />,
  };
}

export function ReleaseMarkdown({ children }: { children: string }) {
  const { md, components } = useMemo(() => {
    const { md, ids } = extractAnchors(children);
    return { md, components: buildComponents(ids) };
  }, [children]);
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{md}</ReactMarkdown>;
}
