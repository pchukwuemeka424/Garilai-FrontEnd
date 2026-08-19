import { Skeleton } from "@/components/portal/ui/skeleton";

export function LoadingPage({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg space-y-6">
        {label && (
          <p className="text-center text-sm font-semibold text-foreground/60">
            {label}
          </p>
        )}
        <div className="space-y-2">
          <Skeleton className="mx-auto h-8 w-56" />
          <Skeleton className="mx-auto h-4 w-80" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
