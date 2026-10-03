# GARIL AI — Institutional Security & Compliance Pack

**Version:** 1.0  
**Date:** 3 October 2026  
**Audience:** Partner universities (ICT, procurement, DPO, academic leadership)

## How to present to a university

Give partners the **assurance pack** below. Keep the detailed internal audit report internal unless under NDA and specifically requested by a security team.

| Share with university | File |
|----------------------|------|
| Security assurance summary | `GARIL-AI-University-Security-Assurance.pdf` |
| SOC 2 readiness (not a certificate) | `GARIL-AI-SOC2-Readiness-Mapping.pdf` |
| Privacy / DPIA input | `GARIL-AI-Data-Protection-Privacy-Overview.pdf` |
| Information security policy | `GARIL-AI-Information-Security-Policy.pdf` |
| AI governance & AUP | `GARIL-AI-AI-Governance-Acceptable-Use.pdf` |
| Incident response | `GARIL-AI-Incident-Response-Overview.pdf` |
| Subprocessors & data flows | `GARIL-AI-Subprocessors-Data-Flows.pdf` |
| Security FAQ | `GARIL-AI-University-Security-FAQ.pdf` |

| Internal / restricted | File |
|----------------------|------|
| Technical defensive audit (findings) | `GARIL-AI-Security-Audit-Report.pdf` |

## Important wording

- **Do say:** “Completed defensive security audit; Critical findings remediated; SOC 2 control readiness mapping available.”
- **Do not say:** “We are SOC 2 certified / ISO 27001 certified” unless an independent auditor has issued that attestation.

## Regenerate

```bash
# University assurance summary
node docs/security/generate-university-security-assurance-pdf.mjs

# Full compliance pack (SOC2 readiness, privacy, policies, IR, FAQ, …)
node docs/security/generate-institutional-compliance-pack.mjs

# Internal technical audit PDF
node docs/security/generate-security-audit-pdf.mjs
```

Or generate everything:

```bash
node docs/security/generate-all-security-docs.mjs
```
