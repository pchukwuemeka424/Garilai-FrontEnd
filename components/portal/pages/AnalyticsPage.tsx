"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { Badge } from "@/components/portal/ui/badge";
import { Progress } from "@/components/portal/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/portal/ui/card";
import { EmptyState } from "@/components/portal/feedback/empty-state";
import { LoadingPage } from "@/components/portal/feedback/loading-page";
import { SimpleBarChart } from "@/components/portal/charts/simple-bar-chart";
import { StatusDonut } from "@/components/portal/charts/status-donut";
import { apiFetch } from "@/lib/portal-api";
import { projectTypeLabel } from "@/lib/portal/project-types";

type StudentInfo = {
  id: string;
  name: string;
  email: string;
};

type SupervisorProject = {
  _id: string;
  title: string;
  projectType: string;
  progressPercent?: number;
  topicStatus?: string;
  updatedAt?: string;
  studentId: string;
  student: StudentInfo | null;
};

type PendingReview = {
  _id: string;
  title: string;
  number: number;
  status: string;
  projectTitle: string;
  student: StudentInfo | null;
};

type Chapter = {
  _id: string;
  title: string;
  status: string;
  number: number;
};

function isApproved(status: string) {
  return status === "approved" || status === "locked";
}

function bucketLabel(pct: number) {
  if (pct >= 80) return "80–100%";
  if (pct >= 50) return "50–79%";
  if (pct >= 20) return "20–49%";
  return "0–19%";
}

export default function SupervisorAnalyticsPage() {
  const [projects, setProjects] = useState<SupervisorProject[]>([]);
  const [pending, setPending] = useState<PendingReview[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [projectList, reviewList] = await Promise.all([
          apiFetch("/api/v1/projects") as Promise<SupervisorProject[]>,
          apiFetch("/api/v1/supervisor/reviews").catch(
            () => [],
          ) as Promise<PendingReview[]>,
        ]);
        if (cancelled) return;

        const chapterLists = await Promise.all(
          projectList.map((p) =>
            apiFetch(`/api/v1/projects/${p._id}/chapters`).catch(
              () => [],
            ) as Promise<Chapter[]>,
          ),
        );
        if (cancelled) return;

        setProjects(projectList);
        setPending(reviewList);
        setChapters(chapterLists.flat());
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load analytics");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const studentIds = new Set(
      projects.map((p) => String(p.student?.id || p.studentId)),
    );
    const avgProgress =
      projects.length === 0
        ? 0
        : Math.round(
            projects.reduce((sum, p) => sum + (p.progressPercent ?? 0), 0) /
              projects.length,
          );

    const approvedChapters = chapters.filter((c) =>
      isApproved(c.status),
    ).length;
    const revisionChapters = chapters.filter(
      (c) => c.status === "needs_revision" || c.status === "rejected",
    ).length;
    const inReviewChapters = chapters.filter(
      (c) => c.status === "submitted" || c.status === "under_review",
    ).length;
    const draftChapters = Math.max(
      chapters.length - approvedChapters - revisionChapters - inReviewChapters,
      0,
    );

    const progressBuckets = [
      { label: "0–19%", value: 0 },
      { label: "20–49%", value: 0 },
      { label: "50–79%", value: 0 },
      { label: "80–100%", value: 0 },
    ];
    for (const project of projects) {
      const label = bucketLabel(project.progressPercent ?? 0);
      const row = progressBuckets.find((b) => b.label === label);
      if (row) row.value += 1;
    }

    const typeMap = new Map<string, number>();
    for (const project of projects) {
      const label = projectTypeLabel(project.projectType);
      typeMap.set(label, (typeMap.get(label) || 0) + 1);
    }
    const typeBars = [...typeMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const topicApproved = projects.filter(
      (p) => p.topicStatus === "approved",
    ).length;
    const topicSubmitted = projects.filter(
      (p) => p.topicStatus === "submitted",
    ).length;

    const byStudent = new Map<
      string,
      { student: StudentInfo; projects: SupervisorProject[]; avg: number }
    >();
    for (const project of projects) {
      const student =
        project.student ||
        ({
          id: String(project.studentId),
          name: "Student",
          email: "",
        } satisfies StudentInfo);
      const existing = byStudent.get(student.id);
      if (existing) {
        existing.projects.push(project);
      } else {
        byStudent.set(student.id, { student, projects: [project], avg: 0 });
      }
    }
    const students = [...byStudent.values()].map((row) => {
      const avg =
        row.projects.length === 0
          ? 0
          : Math.round(
              row.projects.reduce(
                (sum, p) => sum + (p.progressPercent ?? 0),
                0,
              ) / row.projects.length,
            );
      return { ...row, avg };
    });
    students.sort((a, b) => b.avg - a.avg);

    const atRisk = students.filter((s) => s.avg < 20).length;
    const onTrack = students.filter((s) => s.avg >= 50).length;

    return {
      studentCount: studentIds.size,
      projectCount: projects.length,
      avgProgress,
      pendingCount: pending.length,
      approvedChapters,
      revisionChapters,
      inReviewChapters,
      draftChapters,
      chapterTotal: chapters.length,
      progressBuckets,
      typeBars,
      topicApproved,
      topicSubmitted,
      students,
      atRisk,
      onTrack,
    };
  }, [projects, pending, chapters]);

  if (loading) return <LoadingPage label="Loading analytics…" />;

  const empty = projects.length === 0 && pending.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
            Lecturer · Analytics
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold">My analytics</h1>
          <p className="mt-1 text-foreground/60">
            Supervision workload, approval rates, and student progress.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/reviews">
            <Button variant="outline">
              <ClipboardCheck className="size-4" />
              Reviews
            </Button>
          </Link>
          <Link href="/students">
            <Button variant="outline">
              <Users className="size-4" />
              Students
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {empty ? (
        <EmptyState
          title="No analytics yet"
          description="Charts appear once students are assigned and submit chapters for review."
          action="Back to review desk"
          href="/reviews"
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Active students"
              value={String(stats.studentCount)}
              icon={Users}
            />
            <Kpi
              label="Assigned projects"
              value={String(stats.projectCount)}
              icon={BarChart3}
            />
            <Kpi
              label="Pending reviews"
              value={String(stats.pendingCount)}
              icon={ClipboardCheck}
            />
            <Kpi
              label="Avg. approval progress"
              value={`${stats.avgProgress}%`}
              icon={CheckCircle2}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chapter outcomes</CardTitle>
                <CardDescription>
                  Across all chapters in your projects
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <StatusDonut
                  approved={stats.approvedChapters}
                  inProgress={stats.inReviewChapters + stats.draftChapters}
                  rejected={stats.revisionChapters}
                  size={120}
                />
                <ul className="w-full space-y-2 text-sm">
                  <LegendRow
                    color="bg-success"
                    label="Approved"
                    value={stats.approvedChapters}
                  />
                  <LegendRow
                    color="bg-primary"
                    label="In progress / queue"
                    value={stats.inReviewChapters + stats.draftChapters}
                  />
                  <LegendRow
                    color="bg-danger"
                    label="Needs revision"
                    value={stats.revisionChapters}
                  />
                  <li className="flex justify-between border-t border-border pt-2 text-xs text-foreground/55">
                    <span>Total chapters</span>
                    <span className="font-semibold text-foreground">
                      {stats.chapterTotal}
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Student progress distribution
                </CardTitle>
                <CardDescription>
                  How many projects sit in each approval band
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats.progressBuckets.every((b) => b.value === 0) ? (
                  <p className="py-10 text-center text-sm text-foreground/55">
                    No project progress data yet.
                  </p>
                ) : (
                  <SimpleBarChart data={stats.progressBuckets} />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Project types</CardTitle>
                <CardDescription>
                  Workload by research programme type
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats.typeBars.length === 0 ? (
                  <p className="py-10 text-center text-sm text-foreground/55">
                    No projects assigned.
                  </p>
                ) : (
                  <SimpleBarChart data={stats.typeBars} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Topic pipeline</CardTitle>
                <CardDescription>
                  Topic approval status across assigned projects
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <MetricRow
                  label="Topics approved"
                  value={stats.topicApproved}
                  total={stats.projectCount}
                />
                <MetricRow
                  label="Topics submitted"
                  value={stats.topicSubmitted}
                  total={stats.projectCount}
                />
                <MetricRow
                  label="Students on track (≥50%)"
                  value={stats.onTrack}
                  total={stats.studentCount}
                />
                <div className="flex items-center justify-between rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
                  <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                    <AlertTriangle className="size-4 text-warning" />
                    At-risk students (&lt;20%)
                  </span>
                  <Badge variant="warning">{stats.atRisk}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Student progress board</CardTitle>
              <CardDescription>
                Average approval progress per supervisee
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.students.length === 0 ? (
                <EmptyState
                  title="No supervisees"
                  description="Students appear here after they select you on project create."
                  action="Review desk"
                  href="/reviews"
                />
              ) : (
                <ul className="space-y-3">
                  {stats.students.map(({ student, projects: rows, avg }) => (
                    <li key={student.id}>
                      <Link
                        href={`/students/${student.id}`}
                        className="block rounded-2xl border border-border bg-muted/15 px-4 py-3 transition hover:border-accent/40 hover:bg-accent/5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">{student.name}</p>
                            <p className="text-xs text-foreground/55">
                              {rows.length} project
                              {rows.length === 1 ? "" : "s"}
                              {rows[0]
                                ? ` · ${rows[0].title}`
                                : student.email
                                  ? ` · ${student.email}`
                                  : ""}
                            </p>
                          </div>
                          <Badge
                            variant={
                              avg >= 50
                                ? "success"
                                : avg < 20
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {avg}%
                          </Badge>
                        </div>
                        <Progress value={avg} className="mt-3 h-1.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {pending.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Open review queue</CardTitle>
                <CardDescription>
                  Chapters still waiting on your decision
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {pending.slice(0, 8).map((item) => (
                    <li key={item._id}>
                      <Link
                        href={`/reviews/${item._id}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-sm transition hover:border-accent/40 hover:bg-accent/5"
                      >
                        <span className="font-semibold">
                          Ch.{item.number} · {item.title}
                        </span>
                        <span className="text-xs text-foreground/55">
                          {item.student?.name || "Student"} · {item.projectTitle}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 py-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-foreground/55">{label}</p>
          <Icon className="size-4 text-primary" />
        </div>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function LegendRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-2 text-foreground/70">
        <span className={`size-2.5 rounded-full ${color}`} />
        {label}
      </span>
      <span className="font-bold tabular-nums">{value}</span>
    </li>
  );
}

function MetricRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground/65">{label}</span>
        <span className="font-semibold tabular-nums">
          {value}
          <span className="text-foreground/45"> / {total}</span>
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}
