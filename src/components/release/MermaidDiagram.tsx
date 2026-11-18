// Renders a ```mermaid block (ERD, flowcharts) on the temporary /kesiapanrilis page.
// mermaid is loaded only when a document with a diagram is opened (separate chunk).
import { useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";

export function MermaidDiagram({ code }: { code: string }) {
  const rawId = useId();
  const id = `mmd${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default", maxTextSize: 200_000 });
        const out = await mermaid.render(id, code);
        if (!cancelled) setSvg(out.svg);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [code, id]);

  if (error) {
    return (
      <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        Diagram tidak bisa digambar: {error}
        <pre className="mt-2 overflow-x-auto whitespace-pre font-mono text-[11px]">{code}</pre>
      </div>
    );
  }
  if (!svg) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border p-4 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Menggambar diagram…
      </div>
    );
  }
  return (
    <div
      className="mt-3 overflow-x-auto rounded-xl border border-border bg-white p-3 [&_svg]:h-auto [&_svg]:max-w-none"
      // Output of mermaid with securityLevel "strict", from our own documents.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
