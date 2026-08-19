import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/portal/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold no-underline transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] disabled:pointer-events-none disabled:opacity-50 hover:no-underline",
  {
    variants: {
      variant: {
        default:
          "portal-btn border-0 bg-[#0D0B61] text-white shadow-[0_2px_8px_rgba(13,11,97,0.18)] hover:bg-[#12108a] hover:text-white hover:no-underline",
        secondary:
          "portal-btn-muted border-0 bg-[#ececf8] text-[#0D0B61] hover:bg-[#dddcf3] hover:no-underline",
        outline:
          "portal-btn-muted border border-[#0D0B61]/20 bg-white text-[#0D0B61] hover:bg-[#ececf8] hover:no-underline",
        ghost: "portal-btn-muted text-[#0D0B61] hover:bg-[#ececf8] hover:no-underline",
        success:
          "portal-btn border-0 bg-[#0D0B61] text-white hover:bg-[#12108a] hover:text-white hover:no-underline",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-6",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, children, ...props },
    ref,
  ) => {
    const classes = cn(buttonVariants({ variant, size }), className);

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{
        className?: string;
        children?: React.ReactNode;
      }>;
      return React.cloneElement(child, {
        className: cn(classes, child.props.className),
        // Preserve child children (e.g. Link content)
        children: child.props.children,
      });
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
