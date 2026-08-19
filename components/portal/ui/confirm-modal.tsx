"use client";

import { useEffect } from "react";
import { Button } from "@/components/portal/ui/button";
import { cn } from "@/lib/portal/cn";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
};

/** Centered confirmation dialog for review and destructive actions. */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  loadingLabel,
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const busyLabel =
    loadingLabel || (variant === "danger" ? "Deleting…" : "Please wait…");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 border-0 bg-slate-900/50 backdrop-blur-sm"
        aria-label="Close dialog"
        disabled={loading}
        onClick={() => {
          if (!loading) onCancel();
        }}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200/90 bg-white p-6 shadow-[0_24px_64px_rgba(15,23,42,0.28)]">
        <span
          className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#0d0b61] to-[#3b82f6]"
          aria-hidden
        />
        <h2
          id="confirm-modal-title"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-foreground/65">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={loading}
            className={cn(
              variant === "danger" && "bg-danger text-white hover:bg-danger/90",
            )}
            onClick={onConfirm}
          >
            {loading ? busyLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
