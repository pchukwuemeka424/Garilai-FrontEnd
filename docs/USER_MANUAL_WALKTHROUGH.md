# GARIL AI — User Manual & Walkthrough

**Governed AI for Research, Instruction and Learning**

A practical guide for students, lecturers, researchers, and university administrators.

---

## What is GARIL AI?

GARIL AI helps you move from a research topic to a structured, citation-backed academic document — and helps lecturers supervise students and institutions govern AI use.

You can:

- Generate and evaluate research ideas
- Build literature-backed outlines
- Draft papers, assignments, theses, and dissertations with verified citations
- Keep notes, datasets, and figures in a Research Notebook
- Supervise student projects, chapters, and assignments (lecturers)
- Monitor AI usage, tokens, audit logs, and policies (admins)

GARIL is designed for universities, colleges, and polytechnics. Your account is tied to your institution.

---

## Who this guide is for

| You are… | Start here |
|----------|------------|
| **Student** | [Register & login](#1-create-your-account) → [Student walkthrough](#part-b--student-walkthrough) |
| **Lecturer / researcher** | [Register & login](#1-create-your-account) → [Lecturer walkthrough](#part-a--lecturer--researcher-walkthrough) |
| **University admin** | [Admin login](#part-c--university-admin-walkthrough) |
| **Platform / super admin** | [Super-admin walkthrough](#part-d--super-admin-walkthrough) |

---

## Before you begin

1. Your **university must be onboarded** on GARIL (ask your ICT / research office if you cannot find it at signup).
2. **Lecturers** must use an **institutional email** (personal free-email domains are blocked).
3. **Students** and **lecturers** have separate signup and login pages — use the correct one.
4. AI writing uses a **token allowance**. If generation stops with a quota message, contact your university admin.

---

# Getting started (everyone)

## 1. Create your account

### Lecturers and researchers

1. Open the GARIL website.
2. Go to **Register** (`/register`).
3. Select your **university** from the list.
4. Enter your institutional email, name, and password.
5. Submit, then go to **Login** (`/login`).

### Students

1. Open the GARIL website.
2. Go to **Student Register** (`/student/register`).
3. Select your university and complete the form.
4. Log in at **Student Login** (`/student/login`).

### After login — where you land

| Role | Home screen |
|------|-------------|
| Lecturer / researcher | **Dashboard** (`/dashboard`) |
| Student | **Student Dashboard** (`/student/dashboard`) |
| University admin | **Governance Dashboard** (`/admin`) |
| Super admin | **Platform overview** (`/super-admin`) |

---

## 2. Choose the right research type

When you start Research Assistant, pick the document type that matches your goal. This controls structure, length, and how many scholarly sources the AI aims to use.

| Research type | Best for | Rough length | Min. distinct sources (target) |
|---------------|----------|--------------|--------------------------------|
| **Assignment** | Coursework essays | ~2,000 words | 20 |
| **Conference paper** | Symposium / conference | ~3,000–4,000 | 20 |
| **Journal / Research Paper** | Peer-reviewed article style | ~4,000–6,000 | 25 |
| **Undergraduate project** | Final-year project | ~6,000–8,000 | 25 |
| **Thesis** | Master's thesis | ~8,000–10,000 | 40 |
| **Dissertation** | Doctoral dissertation | ~10,000–12,000 | 50 |

**Tip:** Pick the type first. Changing type later changes headings and citation expectations.

---

# Part A — Lecturer / researcher walkthrough

## A1. Know your dashboard

After login you see quick tools:

| Tool | What it does |
|------|----------------|
| **Research Assistant** | Ideas → outline → full draft with citations |
| **Research Notebook** | Notes, datasets, questionnaires, figures |
| **Projects** | Supervise student theses / dissertations / folders |
| **Reviews** | Review submitted chapters and drafts |
| **Assignments** | Publish briefs and mark submissions |
| **Students** | See your supervisees |
| **Analytics** | Snapshot of supervision activity |
| **Notifications** | Updates from the workspace |

---

## A2. Walkthrough: write a research paper (core path)

This is the main day-to-day flow.

### Step 1 — Open Research Assistant

1. From the dashboard, click **Research Assistant**.
2. You arrive at `/research`.

### Step 2 — Set up your topic

1. Choose your **discipline** (field of study).
2. Enter a clear **topic** (be specific; vague topics produce vague ideas).
3. Select the **research type** (Assignment, Journal, Thesis, etc.).
4. Optionally refine focus (empirical, theoretical, applied, …).
5. Click to **generate research ideas**.

You will see several idea options. Read titles, aims, and suggested questions. **Select one idea** to continue.

### Step 3 — Build an outline

1. Continue to **Outline** (`/research/outline`).
2. GARIL searches academic sources and drafts a structured outline grounded in real papers.
3. Review the outline and the “sources for further reading”.
4. Edit if needed, then proceed.

### Step 4 — Configure the draft

1. Open **Generate** (`/research/generate`).
2. Choose **citation style** (for example APA) and any paper options offered on screen.
3. Confirm you are ready to generate the full document.

### Step 5 — Generate the paper

1. Open **Paper** (`/research/paper`).
2. Generation streams live (you see text appear section by section).
3. Wait until the run finishes. Do not close the tab mid-stream if you can avoid it.
4. Review headings, claims, and the **References** list.

**What “citation-backed” means:** GARIL retrieves real papers first, then asks the AI to write using that source bank — so references should map to retrieved literature, not invented titles.

### Step 6 — Save and return later

1. Open **Saved** (`/research/saved`) to find completed papers.
2. Re-open any item to continue reviewing or exporting from the UI tools available on that screen.

**Assignment shortcut:** use `/research/assignment` when your deliverable is coursework-shaped rather than a journal article.

---

## A3. Walkthrough: Research Notebook

Use the notebook when you need a living workspace, not only a one-shot paper.

1. Open **Research Notebook** (`/research/notebook`).
2. Create or select a **project**.
3. Add **documents**, **references**, **datasets**, or **questionnaires** as your study progresses.
4. Use visualizations / figures where the UI offers them.
5. Return anytime — your project stays under that notebook entry.

---

## A4. Walkthrough: supervise a student project

1. Open **Projects** (`/supervision/projects`).
2. Open a student’s project (or create one according to your institution’s process).
3. Review **pages / chapters** in the editor.
4. For chapters awaiting you:
   - Approve or reject
   - Leave review notes
   - Use **AI chapter review** as a second opinion (you remain the academic decision-maker)
5. Approve **topics** when students submit them for approval.
6. Attach **assignment briefs**, set scores, and export documents when needed.
7. Check **Reviews** (`/reviews`) for items waiting in your inbox.
8. Use **Students** (`/students`) to track who you supervise.

---

## A5. Walkthrough: publish an assignment brief

1. Open **Assignments** (`/assignments`).
2. Click **New** (`/assignments/new`).
3. Write the brief (instructions, deadlines, expectations).
4. Save / publish so students can see it under their Assignments area.
5. Later, open the assignment to review submissions and export scores.

---

## A6. Notifications and analytics

- **Notifications** (`/notifications`) — chapter submissions, feedback events, and workspace updates.
- **Analytics** (`/analytics`) — high-level view of supervision activity in your workspace.

---

# Part B — Student walkthrough

## B1. Know your student home

| Area | Path | Use it to… |
|------|------|------------|
| **Dashboard** | `/student/dashboard` | Start your day |
| **Research Assistant** | `/student/research` | Ideas → outline → paper |
| **Research Notebook** | `/student/research/notebook` | Notes and project materials |
| **Student Assistant** | `/student/assistant` | Hub for projects, assignments, feedback |
| **Projects** | `/student/projects` | Write thesis / dissertation chapters with your supervisor |
| **Assignments** | `/student/assignments` | Open lecturer briefs and submit work |
| **Feedback** | `/student/feedback` | Read supervisor comments |
| **Notifications** | `/student/notifications` | Stay on top of updates |

---

## B2. Walkthrough: produce coursework or a paper

Same stages as lecturers, under student URLs:

1. **Research Assistant** → choose discipline, topic, research type.
2. **Generate ideas** → pick one.
3. **Outline** → review literature-backed structure.
4. **Generate / Paper** → stream the draft.
5. **Saved** → reopen finished work.

Paths look like:

`/student/research` → `/student/research/outline` → `/student/research/generate` → `/student/research/paper` → `/student/research/saved`

**Watch your tokens.** Each generation uses part of your allowance. If you hit the limit, ask your lecturer or university admin to increase your quota.

---

## B3. Walkthrough: supervised thesis / dissertation project

1. Open **Student Assistant** → **Projects**, or go to `/student/projects`.
2. Open your project (or create one if allowed).
3. Write in the chapter / page editor.
4. **Submit** chapters or topics when ready for supervisor review.
5. Check **Feedback** for comments and required revisions.
6. Respond to notifications so you do not miss approval or deadline messages.

---

## B4. Walkthrough: complete an assignment from your lecturer

1. Open **Assignments** (`/student/assignments`).
2. Select the brief.
3. Follow instructions and deadlines.
4. Submit through the screens provided for that assignment.
5. Check **Feedback** after marking.

---

# Part C — University admin walkthrough

Login at `/admin/login`. You only see modules your role is allowed to use.

## C1. Daily governance check

1. Open **Governance Dashboard** (`/admin`).
2. Scan **alerts**, adoption, and platform health.
3. Open anything urgent (alerts or incidents).

## C2. Manage usage and cost

1. **Usage Analytics** (`/admin/analytics`) — who uses GARIL by faculty / department / programme.
2. **Token Usage** (`/admin/tokens`) — consumption by group or user; raise or reset allowances when students are blocked.

## C3. Accountability

| Page | Use when you need to… |
|------|------------------------|
| **Audit Log** (`/admin/audit`) | Investigate who did what |
| **Alerts** (`/admin/alerts`) | Respond to high-risk or policy signals |
| **Incidents** (`/admin/incidents`) | Record investigation and resolution |
| **Users** (`/admin/users`) | Activate, suspend, or deactivate accounts |

## C4. Reporting and integrity

1. **Reports** (`/admin/reports`) — generate summaries for Management, Senate, or auditors.
2. **AI Contribution Statements** (`/admin/contributions`) — verify that AI-assistance records exist (without opening private research text unnecessarily).
3. **Research Provenance** (`/admin/provenance`) — process history for integrity reviews.

## C5. Controls

1. **Policies** (`/admin/policies`) — institutional AI rules that can trigger alerts.
2. **Privacy** (`/admin/privacy`) — who may access research-related data.
3. **Retention** (`/admin/retention`) — how long records are kept or deleted.

**Note:** Some older menu items (risks, compliance, inventory, approvals) may redirect to the main admin hub if those screens were retired.

---

# Part D — Super-admin walkthrough

Login at `/super-admin/login`.

| Task | Where |
|------|--------|
| See all onboarded universities | `/super-admin` |
| Onboard or manage a university | `/super-admin/universities` |
| Platform users | `/super-admin/users` |
| University / platform admins | `/super-admin/admins` |
| Token defaults / platform usage | `/super-admin/tokens` |
| Activities | `/super-admin/activities` |
| Research content oversight | `/super-admin/research` |

Typical first-week setup:

1. Onboard the university.
2. Create or invite a university admin.
3. Set student and lecturer token defaults.
4. Confirm lecturers and students can register against that university.

---

# Part E — Tips for better results

## Write better prompts / topics

- Prefer: “Effect of blended learning on undergraduate engagement in Nigerian public universities”
- Avoid: “Education and technology”

## Always review AI output

GARIL grounds writing in retrieved literature, but **you** remain responsible for:

- Accuracy of claims
- Correct interpretation of sources
- Compliance with your department’s integrity policy
- Declaring AI assistance where required

## If generation fails or looks wrong

1. Check you are still logged in.
2. Check **token remaining** (especially students).
3. Retry with a clearer topic or different research type.
4. Contact your university admin if login or university list is wrong.
5. Contact platform support if the whole site or AI service is down.

## Privacy

- Governance staff generally oversee **usage and integrity**, not your private drafts — unless institutional policy explicitly allows access.
- Do not paste confidential personal data (patient records, exam scripts with student IDs, etc.) into prompts unless your university policy permits it.

---

# Quick reference — important links

| Action | Lecturer | Student |
|--------|----------|---------|
| Login | `/login` | `/student/login` |
| Register | `/register` | `/student/register` |
| Home | `/dashboard` | `/student/dashboard` |
| Research | `/research` | `/student/research` |
| Notebook | `/research/notebook` | `/student/research/notebook` |
| Projects | `/supervision/projects` | `/student/projects` |
| Assignments | `/assignments` | `/student/assignments` |
| Saved papers | `/research/saved` | `/student/research/saved` |

| Admin | Path |
|-------|------|
| University admin login | `/admin/login` |
| Governance hub | `/admin` |
| Super-admin login | `/super-admin/login` |
| Super-admin home | `/super-admin` |

---

# Glossary (plain language)

| Term | Meaning |
|------|---------|
| **Research type / scope** | The kind of document you are writing (assignment, thesis, …) |
| **Outline** | Structured plan of sections before the full draft |
| **Citation bank** | The real papers GARIL fetched for this run |
| **Tokens** | Units of AI usage; your account has a limit |
| **Supervision project** | Shared folder/chapters between student and lecturer |
| **Brief** | Assignment instructions published by a lecturer |
| **Provenance** | Record of how AI assisted a piece of work |

---

# One-page cheat sheet

**Lecturer — first paper today**

1. Login → Dashboard  
2. Research Assistant → topic + type → ideas  
3. Outline → Generate → Paper  
4. Review → Saved  

**Student — first assignment today**

1. Student login → Dashboard  
2. Research Assistant (same idea → outline → paper flow)  
3. Or open Assignments from your lecturer  
4. Check Feedback and Notifications  

**Admin — first week**

1. Admin login → Governance Dashboard  
2. Users + Tokens  
3. Policies + Alerts  
4. Generate a first Report for leadership  

---

*End of user manual. For technical setup, APIs, and deployment, see `docs/PROJECT_MANUAL.md`.*
