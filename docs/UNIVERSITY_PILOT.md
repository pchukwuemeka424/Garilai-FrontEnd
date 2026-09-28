# Garil AI — University Pilot Budget Pack

**Product:** GARIL AI (Governed AI for Research, Instruction and Learning)  
**Horizon:** 12 months  
**Currency:** USD  
**Document date:** September 2026

---

## Locked commercial inputs

| Input | Value |
|------|--------|
| Monthly VPS | **$73.99** |
| Annual VPS | **$73.99 × 12 = $887.88** |
| AI cost per user (year seat / allocation) | **$4.40** |
| Recommended first pilot | **100 users** |

### VPS specification

| Spec | Value |
|------|--------|
| vCPU | 8 cores |
| RAM | 32 GB |
| Disk | 400 GB NVMe |
| Bandwidth | 32 TB / month |
| Monthly price | $73.99 |
| Annual price | $887.88 |

---

## 1. Executive summary

Garil AI for a university pilot runs on **one VPS** (application + MongoDB + optional object storage) plus **OpenRouter** for model inference (default main model: GPT-5.1; fast path: gpt-4o-mini).

| Item | Figure |
|------|--------|
| Monthly hosting | **$73.99** |
| Annual hosting | **$887.88** |
| AI per user | **$4.40** |
| Recommended cohort | **100 users** |
| Year-1 total @ 100 users | **$1,327.88** |
| All-in cost per user @ 100 | **$13.28 / year** |

This VPS is sized comfortably for a **50–500 user** pilot.

---

## 2. What runs on the VPS

| Service | Role |
|---------|------|
| Next.js frontend | Web UI |
| Fastify API | Auth, research, portal, admin, WebSocket |
| MongoDB | Primary database |
| MinIO (optional) | Large uploads / assets (up to ~2 GB per file when enabled) |

**Not required for pilot:** Redis, Postgres, separate database VPS, or Vercel.

---

## 3. Cost model

```text
Annual infra   = 73.99 × 12
Annual AI      = users × 4.40
Year-1 total   = 887.88 + (users × 4.40)
Per-user all-in = Year-1 total ÷ users
```

### Assumptions

1. **$4.40** is the estimated AI/token cost **per active user for one year seat** (full use of a ~1M-token-style allowance on GPT-5.1 blended rates).
2. Platform token defaults remain **400,000** (students) and **1,000,000** (lecturers/researchers) unless the university overrides them.
3. The in-app admin estimate of **$2 per 1M tokens** is **not** used here; this pack uses the locked **$4.40 per user** figure.
4. Domain, Resend email, Tavily, and Hugging Face are **optional add-ons** and are excluded from the base totals.

---

## 4. Year-1 budget by pilot size

| Users | VPS (12 mo) | AI (users × $4.40) | Year-1 total | Per user all-in |
|------:|------------:|-------------------:|-------------:|----------------:|
| 50 | $887.88 | $220.00 | **$1,107.88** | **$22.16** |
| **100** | **$887.88** | **$440.00** | **$1,327.88** | **$13.28** |
| 200 | $887.88 | $880.00 | **$1,767.88** | **$8.84** |
| 500 | $887.88 | $2,200.00 | **$3,087.88** | **$6.18** |

### Cash-flow view

| Line | Cadence | Amount |
|------|---------|--------|
| VPS | Monthly | $73.99 |
| VPS | Annual | $887.88 |
| AI budget | Per cohort / year | users × $4.40 (OpenRouter pay-as-you-go) |

### With 10% contingency

| Users | Base total | Contingency (10%) | Contingency total |
|------:|-----------:|------------------:|------------------:|
| 50 | $1,107.88 | $110.79 | **$1,218.67** |
| 100 | $1,327.88 | $132.79 | **$1,460.67** |
| 200 | $1,767.88 | $176.79 | **$1,944.67** |
| 500 | $3,087.88 | $308.79 | **$3,396.67** |

---

## 5. Recommended pilot design — 100 users

| Role | Count | Platform default tokens | Notes |
|------|------:|------------------------:|-------|
| Students | 80 | 400,000 | Primary research / learning users |
| Lecturers / researchers | 15 | 1,000,000 | Supervision & research |
| Admins | 5 | n/a | Ops / token management |
| **Total** | **100** | — | AI budget **$440.00** (100 × $4.40) |

For budgeting simplicity, AI is charged at a **flat $4.40 per user**, not split by role.

### Success metrics (Year 1)

- Activation rate of invited users  
- Average tokens used vs allowance  
- Research papers / supervision reviews completed  
- Support tickets and critical incidents  
- Actual spend vs budget (≤ **$1,327.88** base, or ≤ **$1,460.67** with contingency)

---

## 6. Included vs not included

| Included in this budget | Not included |
|-------------------------|--------------|
| VPS ($887.88 / year) | Domain (~$0–20 / year) |
| App + Mongo on same server | Resend email (~$0–20 / mo if heavy) |
| AI seats at $4.40 / user | Tavily / Hugging Face (optional) |
| 32 TB bandwidth | Staff time / training |
| 400 GB disk for pilot data | Second VPS / managed MongoDB Atlas |

---

## 7. Capacity and risk on this VPS

| Resource | Pilot assessment |
|----------|------------------|
| CPU / RAM (8 / 32 GB) | Comfortable for 50–500 lightly concurrent academic users |
| Disk (400 GB NVMe) | Adequate for pilot; monitor Mongo + MinIO + backups |
| Bandwidth (32 TB) | Far above typical web/API traffic |
| Primary cost risk | AI usage if quotas are raised or users exceed plan |
| Controls | Cap allowances, monitor admin token dashboard, careful resets |

---

## 8. Go-live checklist

1. Provision the VPS; install Coolify (or Docker Compose).  
2. Deploy frontend + backend + MongoDB (+ MinIO if large uploads are required).  
3. Configure `OPENROUTER_API_KEY`, `AUTH_SECRET`, `MONGODB_URI`, `APP_URL`.  
4. Set university token defaults (student / lecturer).  
5. Invite the pilot cohort; brief admins on the token panel.  
6. Track spend monthly: fixed VPS + OpenRouter usage vs AI budget.  
7. Review at month 3 and month 12 against Year-1 total **$1,327.88** (100-user plan).

---

## 9. Stakeholder one-pager

> **Garil AI University Pilot — Year 1**  
> Hosting: 8 vCPU / 32 GB RAM / 400 GB NVMe / 32 TB bandwidth @ **$73.99/mo** (**$887.88/year**).  
> AI: **$4.40 per user**.  
> Recommended cohort: **100 users** → AI **$440.00** → **Year-1 total $1,327.88** (**$13.28 per user**).  
> Optional 10% contingency → **$1,460.67**.

---

## 10. Worked example — 100 users

| Line | Calculation | Amount (USD) |
|------|-------------|-------------:|
| Annual VPS | 73.99 × 12 | 887.88 |
| Annual AI | 100 × 4.40 | 440.00 |
| **Year-1 total** | 887.88 + 440.00 | **1,327.88** |
| Per-user all-in | 1,327.88 ÷ 100 | **13.28** |
| With 10% contingency | 1,327.88 × 1.10 | **1,460.67** |

---

*Prepared for university pilot planning. Figures are locked commercial assumptions for this document; actual OpenRouter invoices will vary with real token consumption.*
