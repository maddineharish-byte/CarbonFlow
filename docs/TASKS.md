# CarbonFlow — Project Task Breakdown & Implementation Roadmap

## Phase 1: Specifications & Documentation (Completed)
- [x] Create PRD (`/docs/PRD.md`)
- [x] Create Architecture specification (`/docs/ARCHITECTURE.md`)
- [x] Create Database schema and indexing guide (`/docs/DATABASE.md`)
- [x] Create API contracts (`/docs/API.md`)
- [x] Create Security & tenant isolation architecture (`/docs/SECURITY.md`)
- [x] Create RBAC matrix & permissions (`/docs/RBAC.md`)
- [x] Create Calculation & unit conversion specification (`/docs/CALCULATIONS.md`)
- [x] Create Audit workflow state machine specification (`/docs/AUDIT_WORKFLOW.md`)
- [x] Create UI/UX design architecture (`/docs/UI_UX.md`)
- [x] Create Test plan (`/docs/TEST_PLAN.md`)
- [x] Create Architectural decisions record (`/docs/DECISIONS.md`)
- [x] Create Execution guide (`/docs/EXECUTION.md`)
- [x] Create Project README (`/docs/README.md`)

## Phase 2: Database Schema & Migration Scripts
- [x] Create Flyway migration script `V1__carbonflow_initial_schema.sql` covering UUIDs, constraints, and tables.
- [x] Create Flyway seed script `V2__seed_reference_data.sql` populating GWP reference sets (AR4, AR5, AR6), emission factor library (Scope 1 combustion & mobile, Scope 2 location & market, refrigerants), and default roles.

## Phase 3: Backend Core Engine & Security
- [x] Implement multi-tenant in-memory relational store with seed data for instant local execution.
- [x] Implement deterministic calculation service using `Decimal.js` (mimicking `BigDecimal`).
- [x] Implement JWT authentication, password hashing, and refresh token rotation.
- [x] Implement RBAC middleware verifying canonical permissions for all 9 roles.
- [x] Implement tenant context isolation ensuring cross-tenant data requests are rejected.
- [x] Implement audit state machine and mandatory checklist validation.
- [x] Implement evidence vault with SHA-256 hash generation and 25MB validation.
- [x] Implement inventory snapshots and carbon target tracking.
- [x] Implement automated integration and security test suite validating Tenant A vs Tenant B isolation.

## Phase 4: Frontend Implementation
- [x] Build navigation and role switcher (testing all 9 roles live).
- [x] Build Executive Dashboard with Scope 1 / Scope 2 Dual Reporting.
- [x] Build Activity Data collection and batch calculation trigger.
- [x] Build Calculation Studio inspecting formula traces, unit normalization, and GWP sets.
- [x] Build Audit & Assurance Desk with 8-state workflow and checklist verification.
- [x] Build Evidence Vault with file upload, SHA-256 hash verification, and link associations.
- [x] Build Inventory Snapshots manager and period locking.
- [x] Build Carbon Targets and Reduction Projects tracker.
- [x] Build Factor Library viewer and reporting export center.

## Phase 5: Verification & Quality Assurance
- [x] Run full automated test suite verifying tenant security, precision math, and audit state transitions.
- [x] Verify production build and compilation.
