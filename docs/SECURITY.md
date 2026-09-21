# CarbonFlow — Security Architecture & Threat Model

## 1. Multi-Tenant Isolation Model

### 1.1 Tenant Context Derivation
- Security context is **never** accepted from untrusted client headers (e.g. raw `X-Organization-Id`) or request parameters alone.
- Upon receiving a request with an `Authorization: Bearer <JWT>` header:
  1. Cryptographically verify signature against `JWT_SECRET`.
  2. Extract `user_id` and authorized tenant claims.
  3. Validate against `organization_memberships` that the user has an active, non-revoked assignment to the target organization.
  4. Inject verified `TenantContext` into the request scope.

### 1.2 Data Access Layer Enforcement
- Every database query for tenant-scoped entities contains an explicit predicate:
  `WHERE organization_id = :tenantId`.
- No operations bypass tenant qualification. Automated security tests verify that requests fabricated with another tenant's ID or entity ID result in an immediate `403 Forbidden` or `404 Not Found`.

---

## 2. Authentication & Token Lifecycle

### 2.1 Cryptographic Standards
- **Password Storage**: Argon2id or bcrypt (salt rounds = 10). Plaintext passwords are never logged, stored, or echoed.
- **Access Tokens**: HMAC-SHA256 (HS256) JWTs with 15-minute expiration time (`exp`).
- **Refresh Tokens**: Cryptographically random 256-bit entropy strings, stored as SHA-256 hashes in `refresh_tokens`, with 7-day expiration.
- **Refresh Token Rotation**: Each refresh request invalidates the previous refresh token and issues a fresh token pair. If a revoked token is presented, the entire token family is immediately invalidated (replay attack detection).

---

## 3. Evidence Vault File Security
1. **File Type Whitelist**:
   - `application/pdf`, `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx), `application/vnd.ms-excel` (.xls), `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx), `image/png`, `image/jpeg`.
   - Content magic bytes are checked alongside MIME types.
2. **File Size Limit**: Strict 25 MB ceiling enforced at the gateway.
3. **Checksum Verification**: System generates SHA-256 hash upon streaming receipt and stores it for tamper detection.
4. **Storage Isolation**: Files are stored in tenant-partitioned private storage (`/storage/organizations/{tenant_id}/{evidence_id}.bin`), preventing path traversal attacks and cross-tenant direct downloads.
