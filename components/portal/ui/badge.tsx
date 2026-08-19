import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/portal/cn";
const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", { variants: { variant: { default: "bg-primary/10 text-primary", success: "bg-success/10 text-success", warning: "bg-warning/15 text-warning", danger: "bg-danger/10 text-danger", neutral: "bg-muted text-foreground/70" } }, defaultVariants: { variant: "default" } });
export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) { return <span className={cn(badgeVariants({ variant }), className)} {...props} />; }
export { badgeVariants };
