// Text of a CMS block: bold, italic, lists, line breaks and links only. No raw HTML
// is rendered (react-markdown without rehype-raw), images are dropped, and a link is
// kept only when it is an internal path or https:// (same rule as the database).
import ReactMarkdown from "react-markdown";
import { urlOk } from "@/lib/cms/cms-validation";
import { cmsMarkdownLines } from "@/lib/cms/cms-markdown";

const ALLOWED = ["p", "strong", "em", "ul", "ol", "li", "a", "br"];

export function CmsRichText({ text, className = "" }: { text: string; className?: string }) {
  if (!text.trim()) return null;
  return (
    <div className={`space-y-2 text-sm leading-relaxed text-foreground/90 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 ${className}`}>
      <ReactMarkdown
        allowedElements={ALLOWED}
        unwrapDisallowed
        components={{
          a: ({ href, children }) =>
            href && urlOk(href) ? (
              <a href={href} className="font-semibold text-marine underline"
                {...(href.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {cmsMarkdownLines(text)}
      </ReactMarkdown>
    </div>
  );
}
