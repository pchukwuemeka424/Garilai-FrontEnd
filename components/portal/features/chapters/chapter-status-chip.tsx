import { Badge } from "@/components/portal/ui/badge";

const variants = {
  Approved: "success",
  Rejected: "danger",
  "In review": "warning",
  "In progress": "default",
  "Not started": "neutral",
} as const;

export type TimelineStatus = keyof typeof variants;

const labels: Record<TimelineStatus, string> = {
  Approved: "Approved",
  Rejected: "Rejected",
  "In review": "Pending Review",
  "In progress": "In Progress",
  "Not started": "Not Started",
};

export function ChapterStatusChip({ status }: { status: TimelineStatus }) {
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}
