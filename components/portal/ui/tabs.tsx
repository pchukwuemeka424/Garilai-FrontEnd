"use client";
import { useState } from "react";
import { cn } from "@/lib/portal/cn";
export function Tabs({ tabs, defaultValue, children }: { tabs: { value: string; label: string }[]; defaultValue: string; children: (value: string) => React.ReactNode }) { const [active, setActive] = useState(defaultValue); return <div><div className="flex gap-1 border-b border-border">{tabs.map((tab) => <button key={tab.value} onClick={() => setActive(tab.value)} className={cn("border-b-2 px-3 py-2 text-sm font-semibold transition-colors", active === tab.value ? "border-primary text-primary" : "border-transparent text-foreground/55 hover:text-foreground")}>{tab.label}</button>)}</div>{children(active)}</div>; }
