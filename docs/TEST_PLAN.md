# CarbonFlow — Quality Assurance & Test Plan

## 1. Scope of Testing

Testing covers the entire carbon accounting and assurance preparation lifecycle:
1. **Multi-Tenant Security Tests**: Proving Tenant A cannot access, query, or mutate Tenant B records across organizations, facilities, reporting periods, activity data, calculations, evidence, audits, and inventory.
2. **Deterministic Calculation Precision Tests**: Verifying unit normalization, factor application, GWP resolution, and exact decimal results with zero floating-point drift.
3. **Dual-Reporting Non-Aggregation Tests**: Verifying that Scope 2 Location and Scope 2 Market remain strictly segregated and never summed together.
4. **Audit Workflow State Machine Tests**: Enforcing transition rules, rejection and correction paths, and mandatory checklist completion prerequisites before locking.
5. **Evidence Integrity Tests**: Verifying file size limits (≤ 25MB), allowed MIME types, and SHA-256 hash generation.

---

## 2. Automated Test Matrix

| Test ID | Test Category | Target Subsystem | Expected Outcome |
| :--- | :--- | :--- | :--- |
| `SEC-TEN-01` | Multi-Tenancy | `GET /api/v1/facilities` | Tenant B user receives empty or 403 when requesting Tenant A facilities. |
| `SEC-TEN-02` | Multi-Tenancy | `GET /api/v1/activity-data` | Tenant B cannot see Tenant A activity data even with spoofed IDs. |
| `SEC-TEN-03` | Multi-Tenancy | `GET /api/v1/evidence/:id` | Tenant B cannot download Tenant A's private evidence file. |
| `SEC-TEN-04` | Multi-Tenancy | `POST /api/v1/audits/:id/transition` | Cross-tenant audit transition attempts return 403 Forbidden. |
| `SEC-TEN-05` | Multi-Tenancy | `GET /api/v1/inventory` | Tenant B cannot view Tenant A's inventory snapshots. |
| `CALC-PRC-01` | Precision Math | Calculation Engine | 50,000 kWh natural gas produces exact deterministic decimal value without rounding drift. |
| `CALC-S2D-02` | Dual-Reporting | Scope 2 Ledger | Location and Market calculations generate distinct records; totals report both side-by-side. |
| `AUD-WFL-01` | Governance | Audit State Machine | Attempting to move from `REVIEW` to `APPROVED` with incomplete checklist items fails with structured 400 error. |
| `AUD-WFL-02` | Governance | Correction Path | `REVIEW` -> `CORRECTION_REQUESTED` moves state cleanly back to `DATA_COLLECTION`. |
| `EVD-SEC-01` | Integrity | Evidence Vault | Upload generates correct SHA-256 hash; unauthorized mime-type is rejected. |

---

## 3. Automated Execution
Tests are executed via backend test runner (`test-runner.ts` / integration tests) and can be executed via `npm test` or via the automated verification endpoint.
