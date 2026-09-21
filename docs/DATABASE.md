# CarbonFlow — Database Architecture & Data Dictionary

## 1. Design Principles
1. **UUID Primary Keys**: All relational tables use RFC 4122 v4 UUID primary keys (`gen_random_uuid()`).
2. **Strict Foreign Key Constraints**: All domain entities reference parent tenants via `organization_id` with `ON DELETE RESTRICT` or `CASCADE` where appropriate.
3. **Audit Columns**: Core tables include `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP` and `updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`.
4. **Controlled Values over Database ENUMs**: Portable `CHECK` constraints or referenced lookup tables are utilized rather than database-level enums to simplify migration, validation, and serialization.
5. **No Double-Counting**: Emission records maintain a status flag (`ACTIVE`, `SUPERSEDED`, `VOIDED`) ensuring queries sum only verified active calculations.

---

## 2. Core Relational Domains & Entities

### 2.1 Identity & Security Domain
- `organizations`: Tenant root (`id`, `name`, `tax_id`, `created_at`, `updated_at`).
- `organization_settings`: Organization configurations (`id`, `organization_id`, `default_gwp_set_id`, `base_year`, `consolidation_approach`).
- `users`: User identity (`id`, `email`, `password_hash`, `full_name`, `is_active`, `created_at`).
- `roles`: Role definitions (`id`, `name`, `description`).
- `permissions`: Canonical permissions (`id`, `code`, `description`).
- `role_permissions`: Role-to-permission mapping (`role_id`, `permission_id`).
- `organization_memberships`: User-to-tenant mapping (`id`, `organization_id`, `user_id`, `role_id`, `is_active`).
- `refresh_tokens`: Refresh tokens for authentication (`id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`).
- `audit_logs`: System-level security trail (`id`, `organization_id`, `user_id`, `action`, `resource_type`, `resource_id`, `details`, `ip_address`, `timestamp`).

### 2.2 Organization & Hierarchy Domain
- `legal_entities`: Legal entities under tenant (`id`, `organization_id`, `name`, `jurisdiction`, `registration_number`).
- `facilities`: Physical sites (`id`, `organization_id`, `legal_entity_id`, `name`, `facility_code`, `country`, `state_province`, `grid_region`).
- `departments`: Operational subdivisions (`id`, `organization_id`, `facility_id`, `name`).
- `reporting_periods`: Temporal accounting periods (`id`, `organization_id`, `name`, `start_date`, `end_date`, `status`).
- `organizational_boundaries`: Scope & boundary rules (`id`, `organization_id`, `reporting_period_id`, `consolidation_approach`, `description`).
- `boundary_legal_entities`: Join table associating entities with boundaries.
- `boundary_facilities`: Join table associating facilities with boundaries.

### 2.3 Reference Data Domain
- `gwp_sets`: Global Warming Potential reference sets (`id`, `code`, `name`, `assessment_report`, `publication_year`).
- `gwp_values`: Gas-specific GWP values (`id`, `gwp_set_id`, `gas`, `gwp_100yr`).
- `calculation_methodologies`: GHG Protocol, ISO 14064, DEFRA, US EPA (`id`, `code`, `name`, `version`).
- `emission_factors`: Factor headers (`id`, `scope`, `category`, `activity_type`, `unit`, `fuel_or_activity`).
- `emission_factor_versions`: Versioned factor values (`id`, `emission_factor_id`, `version_number`, `co2_factor`, `ch4_factor`, `n2o_factor`, `co2e_factor`, `source`, `source_year`, `geography`, `effective_start`, `effective_end`, `status`).

### 2.4 Activity Data & Requests Domain
- `activity_data`: Operational inputs (`id`, `organization_id`, `reporting_period_id`, `facility_id`, `department_id`, `scope`, `category`, `activity_type`, `quantity`, `unit`, `start_date`, `end_date`, `source`, `status`, `submitted_by`).
- `data_requests`: Internal requests for data collection (`id`, `organization_id`, `reporting_period_id`, `facility_id`, `category`, `assignee_id`, `due_date`, `status`, `notes`).

### 2.5 Calculations & Emissions Domain
- `calculations`: Mathematical calculation execution snapshot (`id`, `organization_id`, `activity_data_id`, `reporting_period_id`, `factor_version_id`, `gwp_set_id`, `original_quantity`, `original_unit`, `normalized_quantity`, `normalized_unit`, `factor_value`, `gwp_value`, `total_co2e_kg`, `total_co2e_tonnes`, `calculation_hash`, `calculated_at`, `calculated_by`).
- `calculation_gas_results`: Individual greenhouse gas breakdown (`id`, `calculation_id`, `gas`, `raw_gas_emission_kg`, `gwp_applied`, `co2e_kg`).
- `emission_records`: Ledger entries (`id`, `organization_id`, `reporting_period_id`, `facility_id`, `calculation_id`, `scope`, `category`, `scope2_type`, `co2e_tonnes`, `status`).

### 2.6 Audit & Review Domain
- `carbon_audits`: Audit instances (`id`, `organization_id`, `reporting_period_id`, `status`, `initiated_by`, `approved_by`, `locked_at`, `notes`).
- `audit_checklist_items`: Mandatory audit readiness items (`id`, `audit_id`, `code`, `title`, `is_mandatory`, `is_satisfied`, `verified_by`, `verified_at`).
- `review_records`: Stage reviews (`id`, `audit_id`, `reviewer_id`, `stage`, `decision`, `comments`, `created_at`).
- `review_findings`: Formal discrepancies or notes (`id`, `audit_id`, `activity_data_id`, `severity`, `title`, `description`, `status`, `created_by`, `resolved_by`).
- `review_comments`: Audit conversation threads (`id`, `audit_id`, `user_id`, `comment_text`, `created_at`).
- `correction_requests`: Formal request for data fix (`id`, `audit_id`, `activity_data_id`, `reason`, `requested_by`, `is_resolved`).
- `audit_approvals`: Formal approval sign-offs (`id`, `audit_id`, `approver_id`, `role`, `timestamp`, `signature_hash`).
- `audit_lock_events`: Tamper-proof period freeze record (`id`, `audit_id`, `locked_by`, `locked_at`, `inventory_hash`).

### 2.7 Evidence Vault Domain
- `evidence_records`: Evidence metadata (`id`, `organization_id`, `file_name`, `file_size_bytes`, `mime_type`, `sha256_hash`, `storage_path`, `uploaded_by`, `created_at`).
- `evidence_versions`: File update versions (`id`, `evidence_record_id`, `version_number`, `sha256_hash`, `storage_path`, `created_at`).
- `evidence_links`: Polymorphic association (`id`, `evidence_record_id`, `entity_type`, `entity_id`).
- `evidence_requests`: Requests for supporting documentation (`id`, `organization_id`, `reporting_period_id`, `title`, `assigned_to`, `status`).

### 2.8 Inventory, Targets & Reduction Domain
- `inventory_snapshots`: Immutable aggregated GHG report (`id`, `organization_id`, `reporting_period_id`, `audit_id`, `scope1_co2e_t`, `scope2_location_co2e_t`, `scope2_market_co2e_t`, `biogenic_co2e_t`, `status`, `snapshot_hash`, `created_at`).
- `carbon_targets`: Long-term reduction goals (`id`, `organization_id`, `name`, `baseline_period_id`, `target_period_id`, `baseline_value_t`, `target_value_t`, `reduction_percentage`, `status`, `owner_id`).
- `reduction_projects`: Decarbonization initiatives (`id`, `organization_id`, `target_id`, `name`, `description`, `facility_id`, `baseline_t`, `expected_reduction_t`, `actual_reduction_t`, `start_date`, `end_date`, `status`, `owner_id`).

---

## 3. Database Indexes for High-Performance Queries
```sql
CREATE INDEX idx_memberships_tenant_user ON organization_memberships (organization_id, user_id);
CREATE INDEX idx_activity_tenant_period ON activity_data (organization_id, reporting_period_id, status);
CREATE INDEX idx_calculations_activity ON calculations (activity_data_id);
CREATE INDEX idx_emissions_tenant_period ON emission_records (organization_id, reporting_period_id, status, scope);
CREATE INDEX idx_evidence_tenant ON evidence_records (organization_id);
CREATE INDEX idx_audits_tenant_period ON carbon_audits (organization_id, reporting_period_id);
CREATE INDEX idx_inventory_tenant_period ON inventory_snapshots (organization_id, reporting_period_id);
```
