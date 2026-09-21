# CarbonFlow — RESTful API Contracts Specification

Base URI: `/api/v1`

## 1. Unified Response Envelopes

### Success Response
```json
{
  "success": true,
  "data": {},
  "message": "Resource retrieved successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Reporting period does not exist or access denied"
  }
}
```

---

## 2. API Endpoints by Domain

### 2.1 Authentication & Profile
- `POST /api/v1/auth/register` — Register user & organization.
- `POST /api/v1/auth/login` — Authenticate and receive `accessToken` (15m) and `refreshToken` (7d).
- `POST /api/v1/auth/refresh` — Rotate refresh token and issue fresh access token.
- `POST /api/v1/auth/logout` — Revoke active refresh token.
- `GET  /api/v1/auth/me` — Return authenticated user profile and memberships.

### 2.2 Organizations & Boundaries
- `GET  /api/v1/organizations/current` — Current tenant profile and settings.
- `PUT  /api/v1/organizations/current` — Update organization settings (`organization.update`).
- `GET  /api/v1/facilities` — List tenant facilities (`facilities.read`).
- `POST /api/v1/facilities` — Create facility (`facilities.create`).
- `GET  /api/v1/legal-entities` — List legal entities (`organization.read`).
- `POST /api/v1/legal-entities` — Create legal entity (`organization.update`).
- `GET  /api/v1/reporting-periods` — List reporting periods (`reporting_periods.read`).
- `POST /api/v1/reporting-periods` — Create reporting period (`reporting_periods.create`).
- `GET  /api/v1/boundaries` — List organizational boundary definitions.
- `POST /api/v1/boundaries` — Configure reporting boundaries.

### 2.3 Activity Data & Data Requests
- `GET  /api/v1/activity-data` — Query activity data with period & facility filters (`activity_data.read`).
- `POST /api/v1/activity-data` — Create activity data record (`activity_data.create`).
- `PUT  /api/v1/activity-data/:id` — Update activity data (`activity_data.update`).
- `POST /api/v1/activity-data/:id/submit` — Submit activity data for review (`activity_data.submit`).
- `GET  /api/v1/data-requests` — List data collection requests.
- `POST /api/v1/data-requests` — Create data request assignment.

### 2.4 Reference Data (Factors & GWP)
- `GET  /api/v1/reference/gwp-sets` — List supported GWP sets (AR4, AR5, AR6).
- `GET  /api/v1/reference/emission-factors` — List versioned emission factors.
- `POST /api/v1/reference/emission-factors` — Add or version an emission factor (`emission_factors.manage`).

### 2.5 Calculations & Emission Ledger
- `POST /api/v1/calculations/run` — Run calculation for activity data record (`calculations.create`).
- `POST /api/v1/calculations/batch-run` — Trigger batch calculation for reporting period (`calculations.create`).
- `GET  /api/v1/calculations/:id` — Get calculation audit snapshot with formula trace.
- `GET  /api/v1/emissions` — List active emission records with Scope 1 / Scope 2 Dual Reporting breakdown.

### 2.6 Audit Workflow & Review Desk
- `GET  /api/v1/audits` — List audits for reporting periods (`audits.read`).
- `POST /api/v1/audits` — Initiate audit (`audits.create`).
- `GET  /api/v1/audits/:id` — Audit detail including checklist status and review history.
- `POST /api/v1/audits/:id/transition` — Transition audit state (`audits.submit`, `audits.review`, `audits.approve`, `audits.lock`).
- `POST /api/v1/audits/:id/findings` — Log review finding (`audits.review`).
- `POST /api/v1/audits/:id/comments` — Add audit comment (`audits.review`).
- `POST /api/v1/audits/:id/checklist/:itemId/verify` — Verify checklist requirement.

### 2.7 Evidence Vault
- `GET  /api/v1/evidence` — List uploaded evidence documents (`evidence.read`).
- `POST /api/v1/evidence/upload` — Upload file (multipart/form-data, ≤ 25MB) with SHA-256 generation (`evidence.upload`).
- `GET  /api/v1/evidence/:id/download` — Download private evidence file.
- `POST /api/v1/evidence/:id/link` — Link evidence to activity data or audit.

### 2.8 Inventory Snapshots, Targets & Reduction Projects
- `GET  /api/v1/inventory` — List inventory snapshots (`inventory.read`).
- `POST /api/v1/inventory/snapshot` — Generate immutable inventory snapshot (`inventory.create`).
- `POST /api/v1/inventory/:id/lock` — Lock inventory period (`inventory.lock`).
- `GET  /api/v1/targets` — List carbon targets (`targets.read`).
- `POST /api/v1/targets` — Create carbon target (`targets.create`).
- `GET  /api/v1/reduction-projects` — List reduction projects (`reduction_projects.read`).
- `POST /api/v1/reduction-projects` — Create reduction project (`reduction_projects.create`).

### 2.9 Analytics & Reports
- `GET  /api/v1/analytics/dashboard` — Executive summary KPIs, Scope breakdown, audit progress (`analytics.read`).
- `GET  /api/v1/analytics/breakdown` — Detailed scope, facility, and trend series.
- `GET  /api/v1/reports/export` — Export CSV format for emissions ledger and audit packs (`reports.read`).
