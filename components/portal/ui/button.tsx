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
          "portal-btn border-0 bg-emerald-600 text-white shadow-[0_2px_8px_rgba(5,150,105,0.22)] hover:bg-emerald-700 hover:text-white hover:no-underline",
        warning:
          "portal-btn border-0 bg-amber-500 text-white shadow-[0_2px_8px_rgba(217,119,6,0.22)] hover:bg-amber-600 hover:text-white hover:no-underline",
        danger:
          "portal-btn border-0 bg-rose-600 text-white shadow-[0_2px_8px_rgba(225,29,72,0.22)] hover:bg-rose-700 hover:text-white hover:no-underline",
        info: "portal-btn border-0 bg-sky-600 text-white shadow-[0_2px_8px_rgba(2,132,199,0.22)] hover:bg-sky-700 hover:text-white hover:no-underline",
        ai: "portal-btn border-0 bg-violet-600 text-white shadow-[0_2px_8px_rgba(124,58,237,0.22)] hover:bg-violet-700 hover:text-white hover:no-underline",
        slate:
          "portal-btn border-0 bg-slate-600 text-white shadow-[0_2px_8px_rgba(71,85,105,0.22)] hover:bg-slate-700 hover:text-white hover:no-underline",
        successSoft:
          "portal-btn border-0 bg-emerald-600 text-white shadow-[0_2px_8px_rgba(5,150,105,0.22)] hover:bg-emerald-700 hover:text-white hover:no-underline",
        warningSoft:
          "portal-btn border-0 bg-amber-500 text-white shadow-[0_2px_8px_rgba(217,119,6,0.22)] hover:bg-amber-600 hover:text-white hover:no-underline",
        dangerSoft:
          "portal-btn border-0 bg-rose-600 text-white shadow-[0_2px_8px_rgba(225,29,72,0.22)] hover:bg-rose-700 hover:text-white hover:no-underline",
        infoSoft:
          "portal-btn border-0 bg-sky-600 text-white shadow-[0_2px_8px_rgba(2,132,199,0.22)] hover:bg-sky-700 hover:text-white hover:no-underline",
        aiSoft:
          "portal-btn border-0 bg-violet-600 text-white shadow-[0_2px_8px_rgba(124,58,237,0.22)] hover:bg-violet-700 hover:text-white hover:no-underline",
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
