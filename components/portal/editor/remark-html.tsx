import { stripRemarkHtml, remarkIsHtml } from "@/lib/portal/remark-html";
import { cn } from "@/lib/portal/cn";
import { sanitizeHtml } from "@/lib/sanitize-html";

export function RemarkHtml({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const value = String(html || "").trim();
  if (!value) return null;
  if (remarkIsHtml(value)) {
    return (
      <div
        className={cn(
          "document-editor-prose max-w-none text-[15px] leading-relaxed text-foreground/85",
          className,
        )}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
      />
    );
  }
  return (
    <p
      className={cn(
        "whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/85",
        className,
      )}
    >
      {value}
    </p>
  );
}

export { stripRemarkHtml, remarkIsHtml };
