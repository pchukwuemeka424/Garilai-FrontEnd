import { cn } from "@/lib/portal/cn";
export function Avatar({ name, className }: { name: string; className?: string }) { const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2); return <div aria-label={name} className={cn("flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary", className)}>{initials}</div>; }
