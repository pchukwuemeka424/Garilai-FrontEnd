"use client";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/portal/ui/button";
export function ErrorState({ title = "We couldn't load this view", onRetry }: { title?: string; onRetry?: () => void }) { return <div role="alert" className="flex items-center gap-4 rounded-2xl border border-danger/20 bg-danger/5 p-5"><AlertCircle className="size-5 text-danger" /><div className="flex-1"><p className="font-semibold">{title}</p><p className="text-sm text-foreground/60">Please check your connection and try again.</p></div><Button variant="outline" size="sm" onClick={onRetry}>Retry</Button></div>; }
