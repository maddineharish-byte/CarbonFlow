# CarbonFlow — Architectural Decision Records (ADR)

## ADR-001: Deterministic Decimal Arithmetic over Floating Point
- **Context**: Greenhouse gas accounting data is subjected to rigorous third-party financial and sustainability assurance (ISAE 3410). IEEE 754 floating point arithmetic introduces binary rounding errors.
- **Decision**: All calculations use high-precision decimal arithmetic (Java `BigDecimal` standard, implemented via `Decimal.js` in TypeScript runtime).
- **Consequences**: Internal scale is fixed at 8 decimal places with `ROUND_HALF_UP`. Tonnes $CO_2e$ are reported to 4 decimal places. Calculations are 100% reproducible.

---

## ADR-002: Scope 2 Dual-Reporting Model
- **Context**: Under GHG Protocol Corporate Standard (Scope 2 Guidance), companies must report both Location-based (grid average) and Market-based (contractual instruments) emissions.
- **Decision**: Location and Market emission records are maintained as distinct line items. The system strictly forbids summing them ($Location + Market \neq Total$). If market-based factors are unavailable, the record is flagged explicitly rather than copying location data.
- **Consequences**: Executive dashboards and reports display Dual Metrics side-by-side.

---

## ADR-003: Versioned Emission Factor Immutability
- **Context**: Emission factor updates (e.g. annual eGRID or DEFRA releases) must not silently alter historical carbon inventory reports that have already been audited or reported to regulatory bodies.
- **Decision**: Emission factors are versioned. Each calculation links to a specific immutable `factor_version_id`.
- **Consequences**: Updating a factor creates a new version. Existing calculations and inventory snapshots retain historical factor values.

---

## ADR-004: Strict Tenant Context Derivation
- **Context**: In multi-tenant SaaS, trusting client-provided headers such as `X-Organization-Id` enables tenancy spoofing if an attacker tampers with headers.
- **Decision**: The backend derives organization identity exclusively from cryptographically verified user tokens and active memberships in `organization_memberships`. All DB queries enforce `WHERE organization_id = :tenantId`.
- **Consequences**: Complete tenant isolation. Cross-tenant access fails with 403 Forbidden.

---

## ADR-005: 8-State Governed Audit State Machine
- **Context**: Moving unverified carbon accounting data directly into reports creates regulatory and assurance risk.
- **Decision**: Implement an 8-state governed workflow (`DRAFT`, `SUBMITTED`, `DATA_COLLECTION`, `VALIDATION`, `REVIEW`, `APPROVED`, `AUDIT_READY`, `LOCKED`) with mandatory checklist validation before approval and locking.
- **Consequences**: Enforces segregation of duties between data owners, accountants, sustainability managers, and reviewers.
