import * as React from "react";
import { cn } from "@/lib/portal/cn";
export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, ...props }, ref) => <input ref={ref} className={cn("flex h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-foreground/45 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50", className)} {...props} />);
Input.displayName = "Input";
