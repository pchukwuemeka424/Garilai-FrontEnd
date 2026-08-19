import { cn } from "@/lib/portal/cn";
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("animate-pulse rounded-lg bg-muted", className)} {...props} />; }
