# CarbonFlow — System Architecture & Design

## 1. Architectural Overview

CarbonFlow is designed with enterprise-grade multi-tenancy, clean domain separation, deterministic calculation isolation, and an auditable event ledger.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React / TypeScript SPA UI                       │
│  - Executive Dashboard           - Activity Data & Bulk Ledger         │
│  - Boundary & Facility Config    - Versioned Factor Catalog            │
│  - Audit Workflow & Review Desk  - Evidence Vault & Hash Verifier      │
│  - Inventory Snapshots           - Target & Reduction Project Tracker  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ REST / JSON (Bearer JWT)
┌────────────────────────────────────▼───────────────────────────────────┐
│                       Express.js Application Gateway                   │
│  - Auth Middleware (JWT Access, Refresh Token Rotation, RBAC Check)   │
│  - Tenant Context Resolution (Validates User-to-Tenant Membership)     │
│  - Rate Limiting & Input Validation                                   │
│  - Unified API Envelope Formatter                                      │
└───────┬──────────────┬──────────────┬──────────────┬─────────────┬─────┘
        │              │              │              │             │
┌───────▼──────┐┌──────▼──────┐┌──────▼──────┐┌──────▼─────┐┌─────▼──────┐
│ Organization ││ Activity &  ││ Calculation ││ Audit &    ││ Evidence   │
│ & Boundary   ││ Data Request││ Engine      ││ Review     ││ Storage    │
│ Domain       ││ Domain      ││ (Decimal.js)││ State Mach.││ Service    │
└───────┬──────┘└──────┬──────┘└──────┬──────┘└──────┬─────┘└─────┬──────┘
        │              │              │              │            │
┌───────▼──────────────▼──────────────▼──────────────▼────────────▼──────┐
│                    PostgreSQL / Enterprise Relational Schema           │
│   - UUID Primary Keys        - Tenant Foreign Key Isolation            │
│   - Versioned Factor Tables  - Immutable Calculation Snapshots         │
│   - Audit Event Ledger       - Check Constraints & Index Tuning        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Layered Component Responsibilities

### 2.1 Identity & Authorization Layer
- **Token Manager**: Issues short-lived access JWTs (15 min) and persistent, rotatable refresh tokens stored in hashed form.
- **Tenant Context Interceptor**: Derives the caller's authorized tenant from cryptographically signed tokens and verified organization memberships. Reject any impersonation attempts or unverified headers.
- **RBAC Engine**: Matches granular canonical permissions (`activity_data.submit`, `audits.approve`, `calculations.create`) against the role-permission matrix.

### 2.2 Domain Services
- **Organization & Boundary Service**: Manages legal entities, facilities, boundary rules (Operational Control, Financial Control, Equity Share).
- **Activity Data Service**: Handles data collection, unit conversion guards, and links to evidence records.
- **Calculation Engine Service**: An isolated mathematical pipeline executing deterministic decimal math, resolving effective factor versions and GWP tables, creating frozen calculation snapshots, and outputting active emission records.
- **Audit & Governance Service**: Enforces the 8-state audit machine (`DRAFT` to `LOCKED`), validates checklist criteria, and coordinates review findings and correction cycles.
- **Inventory Service**: Aggregates verified emissions into tamper-resistant snapshots per reporting period, maintaining distinct Scope 1, Scope 2 Location, and Scope 2 Market lines.
- **Evidence Storage Service**: Pluggable storage abstraction supporting local filesystem and Supabase S3-compatible cloud storage with SHA-256 integrity hashing.

---

## 3. Technology Stack Specification

| Component | Technology | Specification / Standard |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript | Vite, Tailwind CSS v4, Lucide Icons, Recharts, Motion |
| **API Server** | Node.js (TypeScript / Express) | RESTful JSON, RFC 7519 JWT, RFC 6749 Refresh Tokens |
| **Calculation Engine** | Deterministic Decimal (Decimal.js) | Emulates Java `BigDecimal`, 8-decimal precision, ROUND_HALF_UP |
| **Relational Database** | PostgreSQL | Schema migrations with Flyway naming standard (`V1__...`, `V2__...`) |
| **Storage** | Pluggable (Local / Supabase) | Multi-part uploads, SHA-256 hashing, 25 MB file limit |
