import * as XLSX from "xlsx";

export type SubmissionExportRow = {
  studentName: string;
  email: string;
  matNo: string;
  projectTitle: string;
  courseName: string;
  courseYear: string;
  status: string;
  reviewStatus: string;
  score: number | string;
  maxScore: number | string;
  updatedAt: string;
};

function slugifyFilename(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "assignment";
}

function dateStamp(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Build and download an `.xlsx` workbook of assignment submissions. */
export function exportSubmissionsToExcel(opts: {
  assignmentTitle: string;
  assignmentId: string;
  rows: SubmissionExportRow[];
}) {
  if (opts.rows.length === 0) {
    throw new Error("No submissions to export");
  }

  const sheetRows = opts.rows.map((row) => ({
    "Student name": row.studentName,
    Email: row.email,
    "Mat no": row.matNo,
    "Project title": row.projectTitle,
    Course: row.courseName,
    Year: row.courseYear,
    Status: row.status,
    "Review status": row.reviewStatus,
    Score: row.score,
    "Max score": row.maxScore,
    "Last updated": row.updatedAt,
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  worksheet["!cols"] = [
    { wch: 22 },
    { wch: 28 },
    { wch: 14 },
    { wch: 28 },
    { wch: 18 },
    { wch: 10 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 20 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Submissions");

  const filename = `${slugifyFilename(opts.assignmentTitle)}-${slugifyFilename(opts.assignmentId).slice(0, 8)}-${dateStamp()}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
