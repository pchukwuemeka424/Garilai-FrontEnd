"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Circle,
  MailOpen,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { LoadingPage } from "@/components/portal/feedback/loading-page";
import { ErrorState } from "@/components/portal/feedback/error-state";
import { apiFetch } from "@/lib/portal-api";
import {
  formatNotificationRelative,
  formatNotificationWhen,
  isNotificationUnread,
  notificationHref,
  notificationTypeLabel,
  parseNotificationsPayload,
  type NotificationItem,
} from "@/components/portal/features/notifications/student-notifications";
import { cn } from "@/lib/portal/cn";

type FilterTab = "all" | "unread" | "read";

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  iconClass,
  cardClass,
}: {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  iconClass: string;
  cardClass: string;
}) {
  return (
    <div className={cn("rounded-2xl p-4 text-white shadow-sm", cardClass)}>
      <span
        className={cn(
          "grid size-10 place-items-center rounded-xl bg-white shadow-sm",
          iconClass,
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <p className="mt-3 text-xs font-medium text-white/85">{label}</p>
      <p className="mt-1 text-[1.75rem] font-bold tabular-nums leading-none tracking-tight text-white">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-white/75">{hint}</p>
    </div>
  );
}

export default function StudentNotificationsPage({
  audience = "student",
}: {
  audience?: "student" | "lecturer";
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = parseNotificationsPayload(
        await apiFetch("/api/v1/notifications"),
      );
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load notifications",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const readCount = useMemo(
    () => items.filter((n) => !isNotificationUnread(n)).length,
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((n) => {
      if (filter === "unread" && !isNotificationUnread(n)) return false;
      if (filter === "read" && isNotificationUnread(n)) return false;
      if (!q) return true;
      const hay = [n.title, n.body, n.type, notificationTypeLabel(n.type)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, filter, query]);

  async function markOne(id: string) {
    const target = items.find((n) => n._id === id);
    if (!target || !isNotificationUnread(target)) return;
    setBusyId(id);
    try {
      await apiFetch(`/api/v1/notifications/${id}/read`, { method: "POST" });
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((n) => (n._id === id ? { ...n, readAt: n.readAt || now } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to mark notification as read",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await apiFetch("/api/v1/notifications", { method: "PATCH" });
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || now })),
      );
      setUnreadCount(0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to mark all as read",
      );
    } finally {
      setMarkingAll(false);
    }
  }

  if (loading) return <LoadingPage label="Loading notifications…" />;

  if (error && items.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-[1.75rem] font-bold tracking-tight text-[#0f172a] md:text-[2rem]">
            Notifications
          </h1>
          <p className="mt-1.5 text-[15px] text-[#64748b]">
            Updates from {audience === "lecturer" ? "student submissions and project activity" : "lecturers, reviews, and your research workspace"}.
          </p>
        </div>
        <ErrorState title={error} onRetry={() => void load()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[1.75rem] font-bold tracking-tight text-[#0f172a] md:text-[2rem]">
            Notifications
          </h1>
          <p className="mt-1.5 text-[15px] text-[#64748b]">
            Updates from {audience === "lecturer" ? "student submissions and project activity" : "lecturers, reviews, and your research workspace"}.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          disabled={unreadCount === 0 || markingAll}
          onClick={() => void markAllRead()}
          className="px-5"
        >
          <CheckCheck className="size-4" strokeWidth={2.25} />
          {markingAll ? "Marking…" : "Mark all read"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Total"
          value={items.length}
          hint="All in-app alerts"
          icon={Bell}
          iconClass="text-[#2563eb]"
          cardClass="bg-[#2563eb]"
        />
        <KpiCard
          label="Unread"
          value={unreadCount}
          hint="Waiting for your attention"
          icon={Circle}
          iconClass="text-[#ea580c]"
          cardClass="bg-[#ea580c]"
        />
        <KpiCard
          label="Read"
          value={readCount}
          hint="Already reviewed"
          icon={CheckCircle2}
          iconClass="text-[#059669]"
          cardClass="bg-[#059669]"
        />
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#0f172a]">
              Inbox
            </h2>
            <p className="mt-0.5 text-sm text-[#94a3b8]">
              Open an item to jump to the related work, or mark it as read.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex h-9 items-center rounded-xl border border-[#e8ecf3] bg-white p-0.5 shadow-sm">
              {(
                [
                  ["all", "All"],
                  ["unread", "Unread"],
                  ["read", "Read"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                    filter === value
                      ? "bg-[#0D0B61] text-white"
                      : "text-[#94a3b8] hover:text-[#64748b]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative min-w-[200px] flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notifications…"
                className="h-9 w-full rounded-xl border border-[#e8ecf3] bg-white py-2 pl-9 pr-3 text-xs shadow-sm outline-none placeholder:text-[#94a3b8] focus:border-[#2563eb]/40 focus:ring-2 focus:ring-[#2563eb]/10"
              />
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e8ecf3] bg-white px-6 py-12 text-center shadow-sm">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eff6ff] text-[#2563eb]">
              <Bell className="size-6" strokeWidth={1.75} />
            </span>
            <h3 className="mt-4 text-base font-bold text-[#0f172a]">
              You&apos;re all caught up
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[#94a3b8]">
              New notifications from {audience === "lecturer" ? "students and reviews" : "lecturers and reviews"} will appear here.
            </p>
            <Button
              asChild
              className="mt-5"
            >
              <Link href={audience === "lecturer" ? "/supervision" : "/student/dashboard"}>
                Back to {audience === "lecturer" ? "supervision" : "dashboard"}
              </Link>
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e8ecf3] bg-white px-6 py-10 text-center shadow-sm">
            <p className="font-semibold text-[#0f172a]">No matching notifications</p>
            <p className="mt-1 text-sm text-[#94a3b8]">
              Try another search term or clear the filter.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 rounded-xl"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#e8ecf3] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <div className="hidden border-b border-[#eef1f6] bg-[#f8fafc] px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-[#94a3b8] lg:grid lg:grid-cols-[minmax(0,2fr)_110px_120px_140px] lg:gap-4">
              <span>Notification</span>
              <span>Type</span>
              <span>When</span>
              <span className="text-right">Action</span>
            </div>
            <ul className="divide-y divide-[#eef1f6]">
              {filtered.map((row) => {
                const unread = isNotificationUnread(row);
                const href = notificationHref(row, audience);
                const typeLabel = notificationTypeLabel(row.type);
                const when =
                  formatNotificationRelative(row.createdAt) ||
                  formatNotificationWhen(row.createdAt);

                return (
                  <li
                    key={row._id}
                    className={cn(
                      "px-4 py-4 lg:grid lg:grid-cols-[minmax(0,2fr)_110px_120px_140px] lg:items-center lg:gap-4 lg:px-5",
                      unread && "bg-[#2563eb]/[0.03]",
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl",
                          unread
                            ? "bg-[#eff6ff] text-[#2563eb]"
                            : "bg-[#f1f5f9] text-[#64748b]",
                        )}
                      >
                        <Bell className="size-4" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {unread ? (
                            <span
                              className="size-1.5 shrink-0 rounded-full bg-[#2563eb]"
                              aria-label="Unread"
                            />
                          ) : null}
                          {href ? (
                            <Link
                              href={href}
                              onClick={() => {
                                if (unread) void markOne(row._id);
                              }}
                              className="truncate text-sm font-semibold text-[#0f172a] hover:text-[#2563eb] hover:underline"
                            >
                              {row.title || "Notification"}
                            </Link>
                          ) : (
                            <p className="truncate text-sm font-semibold text-[#0f172a]">
                              {row.title || "Notification"}
                            </p>
                          )}
                        </div>
                        {row.body ? (
                          <p className="mt-0.5 line-clamp-2 text-sm text-[#64748b]">
                            {row.body}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 lg:mt-0">
                      <span className="inline-flex rounded-lg bg-[#f1f5f9] px-2 py-1 text-[11px] font-semibold capitalize text-[#64748b]">
                        {typeLabel}
                      </span>
                    </div>

                    <p
                      className="mt-2 text-xs text-[#94a3b8] lg:mt-0"
                      title={formatNotificationWhen(row.createdAt)}
                    >
                      {when}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2 lg:mt-0">
                      {href ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg border-[#e8ecf3] text-xs font-semibold"
                        >
                          <Link
                            href={href}
                            onClick={() => {
                              if (unread) void markOne(row._id);
                            }}
                          >
                            Open
                          </Link>
                        </Button>
                      ) : null}
                      {unread ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyId === row._id}
                          onClick={() => void markOne(row._id)}
                          className="h-8 rounded-lg bg-[#0D0B61] px-3 text-xs font-semibold text-white hover:bg-[#12108a] hover:text-white"
                        >
                          <MailOpen className="size-3.5" strokeWidth={2} />
                          {busyId === row._id ? "…" : "Mark read"}
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#94a3b8]">
                          <CheckCircle2 className="size-3.5" />
                          Read
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
