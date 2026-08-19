import { cn } from "@/lib/portal/cn";
export function Card({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("rounded-2xl border border-border bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.03)]", className)} {...props} />; }
export function CardHeader({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex flex-col gap-1 p-5 pb-0", className)} {...props} />; }
export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) { return <h3 className={cn("font-semibold tracking-tight", className)} {...props} />; }
export function CardDescription({ className, ...props }: React.ComponentProps<"p">) { return <p className={cn("text-sm text-foreground/60", className)} {...props} />; }
export function CardContent({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("p-5", className)} {...props} />; }
