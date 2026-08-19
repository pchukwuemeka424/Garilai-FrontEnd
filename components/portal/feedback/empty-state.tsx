import Link from "next/link";
import { FileSearch } from "lucide-react";
import { Button } from "@/components/portal/ui/button";

type EmptyStateProps = {
  title?: string;
  description?: string;
  action?: string;
  href?: string;
};

export function EmptyState({
  title = "Nothing here yet",
  description = "Once work is underway, it will appear here.",
  action,
  href,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/25 p-8 text-center">
      <div className="mb-4 rounded-2xl bg-primary/10 p-3 text-primary">
        <FileSearch className="size-6" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-foreground/60">{description}</p>
      {action && href && (
        <Button asChild size="sm" className="mt-5">
          <Link href={href}>{action}</Link>
        </Button>
      )}
      {action && !href && (
        <Button size="sm" className="mt-5" type="button">
          {action}
        </Button>
      )}
    </div>
  );
}
