"use client";

import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/portal/ui/button";

export function StudentToolPlaceholder({
  title,
  description,
  icon: Icon,
  ctaLabel = "Back to dashboard",
  ctaHref = "/student",
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center rounded-2xl border border-[#e8ecf3] bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(21,34,64,0.04)]">
      <span className="grid size-14 place-items-center rounded-2xl bg-[#0D0B61]/5 text-[#0D0B61]">
        <Icon className="size-7" strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-xl font-bold text-[#0f172a]">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-[#64748b]">{description}</p>
      <Link href={ctaHref} className="mt-6">
        <Button>
          {ctaLabel}
        </Button>
      </Link>
    </div>
  );
}
