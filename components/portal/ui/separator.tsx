import { cn } from "@/lib/portal/cn";
export function Separator({ className, orientation = "horizontal" }: { className?: string; orientation?: "horizontal" | "vertical" }) { return <div role="separator" className={cn("bg-border", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)} />; }
