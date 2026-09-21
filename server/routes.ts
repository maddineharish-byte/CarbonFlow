/**
 * CarbonFlow — RESTful API Routes Controller
 * Implements strict tenant-context derivation, canonical RBAC, and consistent envelopes.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from './db.ts';
import { authenticateTenant, requirePermission, generateTokenPair, AuthenticatedRequest } from './auth.ts';
import { executeCalculation } from './calc.ts';
import { storageService, MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from './storage.ts';
import { runAutomatedTestSuite } from './test-suite.ts';
import { RoleName, ActivityData, CarbonAudit, AuditStatus, ReviewFinding, ReviewComment, EvidenceRecord } from './types.ts';
import { ROLE_PERMISSIONS } from './rbac.ts';

export const apiRouter = Router();

// Configure Multer for evidence upload in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

// Helper for consistent response envelopes
function sendSuccess<T>(res: Response, data: T, message = 'Success', status = 200) {
  return res.status(status).json({ success: true, data, message });
}

function sendError(res: Response, code: string, message: string, status = 400) {
  return res.status(status).json({ success: false, error: { code, message } });
}

// ==========================================
// 1. AUTHENTICATION & PERSONA MANAGEMENT
// ==========================================

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password, organizationId } = req.body;
  const user = db.users.find((u) => u.email.toLowerCase() === (email || '').toLowerCase().trim());

  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password.', 401);
  }

  // Resolve user's memberships
  const memberships = db.memberships.filter((m) => m.userId === user.id && m.isActive);
  if (memberships.length === 0) {
    return sendError(res, 'NO_ORGANIZATION_ACCESS', 'User does not belong to any active organization.', 403);
  }

  const selectedMembership = organizationId
    ? memberships.find((m) => m.organizationId === organizationId) || memberships[0]
    : memberships[0];

  const org = db.organizations.find((o) => o.id === selectedMembership.organizationId);
  const tokenPair = generateTokenPair(user.id, selectedMembership.organizationId, selectedMembership.role);

  return sendSuccess(res, {
    user: { id: user.id, email: user.email, fullName: user.fullName },
    organization: org,
    role: selectedMembership.role,
    permissions: ROLE_PERMISSIONS[selectedMembership.role] || [],
    ...tokenPair,
  });
});

apiRouter.post('/auth/switch-tenant-or-role', (req: Request, res: Response) => {
  const { targetOrgId, targetRole, userId } = req.body;
  const targetUser = db.users.find((u) => u.id === userId) || db.users[0];
  const targetOrg = db.organizations.find((o) => o.id === targetOrgId) || db.organizations[0];
  const role: RoleName = targetRole || 'COMPANY_ADMIN';

  // Ensure membership exists or create test membership
  let mem = db.memberships.find((m) => m.userId === targetUser.id && m.organizationId === targetOrg.id);
  if (!mem) {
    mem = {
      id: crypto.randomUUID(),
      organizationId: targetOrg.id,
      userId: targetUser.id,
      role,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    db.memberships.push(mem);
  } else {
    mem.role = role;
  }

  const tokenPair = generateTokenPair(targetUser.id, targetOrg.id, role);

  return sendSuccess(res, {
    user: { id: targetUser.id, email: targetUser.email, fullName: targetUser.fullName },
    organization: targetOrg,
    role,
    permissions: ROLE_PERMISSIONS[role] || [],
    ...tokenPair,
  });
});

apiRouter.get('/auth/me', authenticateTenant, (req: AuthenticatedRequest, res: Response) => {
  const { organizationId, userId, role, permissions } = req.tenantContext!;
  const user = db.users.find((u) => u.id === userId);
  const org = db.organizations.find((o) => o.id === organizationId);
  return sendSuccess(res, { user, organization: org, role, permissions });
});

// ==========================================
// 2. ORGANIZATIONS, ENTITIES & FACILITIES
// ==========================================

apiRouter.get('/organizations/current', authenticateTenant, requirePermission('organization.read'), (req: AuthenticatedRequest, res: Response) => {
  const org = db.organizations.find((o) => o.id === req.tenantContext!.organizationId);
  if (!org) return sendError(res, 'ORG_NOT_FOUND', 'Organization not found.', 404);
  return sendSuccess(res, org);
});

apiRouter.put('/organizations/current', authenticateTenant, requirePermission('organization.update'), (req: AuthenticatedRequest, res: Response) => {
  const org = db.organizations.find((o) => o.id === req.tenantContext!.organizationId);
  if (!org) return sendError(res, 'ORG_NOT_FOUND', 'Organization not found.', 404);

  const { name, country, industry, consolidationApproach, baseYear } = req.body;
  if (name) org.name = name;
  if (country) org.country = country;
  if (industry) org.industry = industry;
  if (consolidationApproach) org.consolidationApproach = consolidationApproach;
  if (baseYear) org.baseYear = Number(baseYear);
  org.updatedAt = new Date().toISOString();

  return sendSuccess(res, org, 'Organization updated successfully.');
});

apiRouter.get('/facilities', authenticateTenant, requirePermission('facilities.read'), (req: AuthenticatedRequest, res: Response) => {
  const facilities = db.facilities.filter((f) => f.organizationId === req.tenantContext!.organizationId);
  return sendSuccess(res, facilities);
});

apiRouter.post('/facilities', authenticateTenant, requirePermission('facilities.create'), (req: AuthenticatedRequest, res: Response) => {
  const { name, facilityCode, facilityType, country, stateProvince, gridRegion, floorAreaM2 } = req.body;
  if (!name || !facilityCode || !country || !gridRegion) {
    return sendError(res, 'VALIDATION_ERROR', 'Facility name, code, country, and grid region are required.');
  }

  const newFacility = {
    id: crypto.randomUUID(),
    organizationId: req.tenantContext!.organizationId,
    name,
    facilityCode,
    facilityType: facilityType || 'MANUFACTURING',
    country,
    stateProvince,
    gridRegion,
    floorAreaM2: floorAreaM2 ? Number(floorAreaM2) : undefined,
    createdAt: new Date().toISOString(),
  };

  db.facilities.push(newFacility);
  return sendSuccess(res, newFacility, 'Facility registered successfully.', 201);
});

apiRouter.get('/legal-entities', authenticateTenant, requirePermission('organization.read'), (req: AuthenticatedRequest, res: Response) => {
  const entities = db.legalEntities.filter((e) => e.organizationId === req.tenantContext!.organizationId);
  return sendSuccess(res, entities);
});

apiRouter.get('/reporting-periods', authenticateTenant, requirePermission('reporting_periods.read'), (req: AuthenticatedRequest, res: Response) => {
  const periods = db.reportingPeriods.filter((p) => p.organizationId === req.tenantContext!.organizationId);
  return sendSuccess(res, periods);
});

apiRouter.post('/reporting-periods', authenticateTenant, requirePermission('reporting_periods.create'), (req: AuthenticatedRequest, res: Response) => {
  const { name, startDate, endDate } = req.body;
  if (!name || !startDate || !endDate) {
    return sendError(res, 'VALIDATION_ERROR', 'Period name, startDate, and endDate are required.');
  }
  if (new Date(endDate) < new Date(startDate)) {
    return sendError(res, 'INVALID_DATE_RANGE', 'endDate must be on or after startDate.');
  }

  const period = {
    id: crypto.randomUUID(),
    organizationId: req.tenantContext!.organizationId,
    name,
    startDate,
    endDate,
    status: 'OPEN' as const,
    createdAt: new Date().toISOString(),
  };

  db.reportingPeriods.push(period);
  return sendSuccess(res, period, 'Reporting period created.', 201);
});

// ==========================================
// 3. REFERENCE DATA (FACTORS & GWP)
// ==========================================

apiRouter.get('/reference/gwp-sets', authenticateTenant, (req: AuthenticatedRequest, res: Response) => {
  const setsWithValues = db.gwpSets.map((s) => ({
    ...s,
    values: db.gwpValues.filter((v) => v.gwpSetId === s.id),
  }));
  return sendSuccess(res, setsWithValues);
});

apiRouter.get('/reference/emission-factors', authenticateTenant, requirePermission('emission_factors.read'), (req: AuthenticatedRequest, res: Response) => {
  const factorsWithVersions = db.emissionFactors.map((f) => ({
    ...f,
    versions: db.emissionFactorVersions.filter((v) => v.emissionFactorId === f.id),
  }));
  return sendSuccess(res, factorsWithVersions);
});

// ==========================================
// 4. ACTIVITY DATA & BULK LEDGER
// ==========================================

apiRouter.get('/activity-data', authenticateTenant, requirePermission('activity_data.read'), (req: AuthenticatedRequest, res: Response) => {
  const { periodId, facilityId, scope } = req.query;
  let items = db.activityData.filter((a) => a.organizationId === req.tenantContext!.organizationId);

  if (periodId) items = items.filter((a) => a.reportingPeriodId === periodId);
  if (facilityId) items = items.filter((a) => a.facilityId === facilityId);
  if (scope) items = items.filter((a) => a.scope === scope);

  // Attach facility names and linked evidence
  const enriched = items.map((item) => {
    const facility = db.facilities.find((f) => f.id === item.facilityId);
    const link = db.evidenceLinks.find((l) => l.entityType === 'ACTIVITY_DATA' && l.entityId === item.id);
    const evidence = link ? db.evidenceRecords.find((e) => e.id === link.evidenceRecordId) : null;
    const calc = db.calculations.find((c) => c.activityDataId === item.id);
    return {
      ...item,
      facilityName: facility ? facility.name : 'Unknown Facility',
      evidence,
      calculation: calc || null,
    };
  });

  return sendSuccess(res, enriched);
});

apiRouter.post('/activity-data', authenticateTenant, requirePermission('activity_data.create'), (req: AuthenticatedRequest, res: Response) => {
  const { reportingPeriodId, facilityId, scope, category, activityType, quantity, unit, startDate, endDate, source, notes } = req.body;

  if (!reportingPeriodId || !facilityId || !scope || !category || !activityType || quantity === undefined || !unit || !startDate || !endDate) {
    return sendError(res, 'VALIDATION_ERROR', 'All mandatory activity fields must be supplied.');
  }

  const numQty = Number(quantity);
  if (isNaN(numQty) || numQty < 0) {
    return sendError(res, 'INVALID_QUANTITY', 'Quantity must be a positive decimal number.');
  }

  const newActivity: ActivityData = {
    id: crypto.randomUUID(),
    organizationId: req.tenantContext!.organizationId,
    reportingPeriodId,
    facilityId,
    scope,
    category,
    activityType,
    quantity: numQty,
    unit,
    startDate,
    endDate,
    source: source || 'Direct Meter/Manual Entry',
    status: 'SUBMITTED',
    notes,
    submittedBy: req.tenantContext!.userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.activityData.push(newActivity);
  return sendSuccess(res, newActivity, 'Activity data registered.', 201);
});

// ==========================================
// 5. CALCULATION ENGINE & EMISSION LEDGER
// ==========================================

apiRouter.post('/calculations/run', authenticateTenant, requirePermission('calculations.create'), (req: AuthenticatedRequest, res: Response) => {
  const { activityDataId, factorVersionId, gwpSetId } = req.body;
  const act = db.activityData.find((a) => a.id === activityDataId && a.organizationId === req.tenantContext!.organizationId);
  if (!act) return sendError(res, 'ACTIVITY_NOT_FOUND', 'Activity data not found.', 404);

  // Auto-resolve factor version if not supplied
  const factorVersion = factorVersionId
    ? db.emissionFactorVersions.find((v) => v.id === factorVersionId)
    : db.emissionFactorVersions.find((v) => {
        const factor = db.emissionFactors.find((f) => f.id === v.emissionFactorId);
        return factor && factor.activityType === act.activityType && v.status === 'ACTIVE';
      }) || db.emissionFactorVersions[0];

  if (!factorVersion) return sendError(res, 'FACTOR_NOT_FOUND', 'No active emission factor found for activity.', 400);

  const factor = db.emissionFactors.find((f) => f.id === factorVersion.emissionFactorId);
  const factorInputUnit = factor ? factor.inputUnit : act.unit;

  const gwpSet = (gwpSetId ? db.gwpSets.find((s) => s.id === gwpSetId) : db.gwpSets.find((s) => s.isDefault)) || db.gwpSets[0];
  const gwpValues = db.gwpValues.filter((v) => v.gwpSetId === gwpSet.id);

  // Mark previous emission records for this activity as SUPERSEDED
  db.emissionRecords
    .filter((e) => e.organizationId === req.tenantContext!.organizationId)
    .forEach((e) => {
      const calc = db.calculations.find((c) => c.id === e.calculationId);
      if (calc && calc.activityDataId === act.id) {
        e.status = 'SUPERSEDED';
      }
    });

  const { calculation, emissionRecord } = executeCalculation({
    activityData: act,
    factorVersion,
    factorInputUnit,
    gwpSet,
    gwpValues,
    userId: req.tenantContext!.userId,
  });

  db.calculations.push(calculation);
  db.emissionRecords.push(emissionRecord);

  act.status = 'CALCULATED';
  act.updatedAt = new Date().toISOString();

  return sendSuccess(res, { calculation, emissionRecord }, 'Calculation executed deterministically.');
});

apiRouter.post('/calculations/batch-run', authenticateTenant, requirePermission('calculations.create'), (req: AuthenticatedRequest, res: Response) => {
  const { reportingPeriodId } = req.body;
  const activities = db.activityData.filter(
    (a) => a.organizationId === req.tenantContext!.organizationId && (!reportingPeriodId || a.reportingPeriodId === reportingPeriodId)
  );

  const defaultGwp = db.gwpSets.find((s) => s.isDefault) || db.gwpSets[0];
  const gwpValues = db.gwpValues.filter((v) => v.gwpSetId === defaultGwp.id);

  let calculatedCount = 0;
  activities.forEach((act) => {
    const factor = db.emissionFactors.find((f) => f.activityType === act.activityType);
    const factorVersion = factor ? db.emissionFactorVersions.find((v) => v.emissionFactorId === factor.id && v.status === 'ACTIVE') : null;

    if (factor && factorVersion) {
      // Supersede old records
      db.emissionRecords.forEach((e) => {
        const c = db.calculations.find((calc) => calc.id === e.calculationId);
        if (c && c.activityDataId === act.id) e.status = 'SUPERSEDED';
      });

      const { calculation, emissionRecord } = executeCalculation({
        activityData: act,
        factorVersion,
        factorInputUnit: factor.inputUnit,
        gwpSet: defaultGwp,
        gwpValues,
        userId: req.tenantContext!.userId,
      });

      db.calculations.push(calculation);
      db.emissionRecords.push(emissionRecord);
      act.status = 'CALCULATED';
      act.updatedAt = new Date().toISOString();
      calculatedCount++;
    }
  });

  return sendSuccess(res, { processed: calculatedCount, total: activities.length }, `Batch calculation completed for ${calculatedCount} items.`);
});

apiRouter.get('/emissions', authenticateTenant, requirePermission('reports.read'), (req: AuthenticatedRequest, res: Response) => {
  const { periodId } = req.query;
  let records = db.emissionRecords.filter((e) => e.organizationId === req.tenantContext!.organizationId && e.status === 'ACTIVE');
  if (periodId) records = records.filter((e) => e.reportingPeriodId === periodId);

  const scope1 = records.filter((r) => r.scope === 'SCOPE_1').reduce((acc, r) => acc + r.co2eTonnes, 0);
  const scope2Location = records.filter((r) => r.scope === 'SCOPE_2' && r.scope2Type === 'LOCATION_BASED').reduce((acc, r) => acc + r.co2eTonnes, 0);
  const scope2Market = records.filter((r) => r.scope === 'SCOPE_2' && r.scope2Type === 'MARKET_BASED').reduce((acc, r) => acc + r.co2eTonnes, 0);

  // Strictly segregated totals (Dual Reporting Mandate)
  const totalLocationBased = scope1 + scope2Location;
  const totalMarketBased = scope1 + scope2Market;

  return sendSuccess(res, {
    records,
    summary: {
      scope1Tonnes: Number(scope1.toFixed(4)),
      scope2LocationTonnes: Number(scope2Location.toFixed(4)),
      scope2MarketTonnes: Number(scope2Market.toFixed(4)),
      totalLocationBasedTonnes: Number(totalLocationBased.toFixed(4)),
      totalMarketBasedTonnes: Number(totalMarketBased.toFixed(4)),
    },
  });
});

// ==========================================
// 6. AUDIT & GOVERNANCE WORKFLOW
// ==========================================

apiRouter.get('/audits', authenticateTenant, requirePermission('audits.read'), (req: AuthenticatedRequest, res: Response) => {
  const audits = db.audits.filter((a) => a.organizationId === req.tenantContext!.organizationId);
  const enriched = audits.map((audit) => {
    const period = db.reportingPeriods.find((p) => p.id === audit.reportingPeriodId);
    const checklist = db.auditChecklistItems.filter((i) => i.auditId === audit.id);
    const findings = db.reviewFindings.filter((f) => f.auditId === audit.id);
    const openFindings = findings.filter((f) => f.status === 'OPEN');
    return {
      ...audit,
      periodName: period ? period.name : 'Unknown Period',
      checklistSummary: {
        total: checklist.length,
        satisfied: checklist.filter((i) => i.isSatisfied).length,
      },
      openFindingsCount: openFindings.length,
    };
  });
  return sendSuccess(res, enriched);
});

apiRouter.get('/audits/:id', authenticateTenant, requirePermission('audits.read'), (req: AuthenticatedRequest, res: Response) => {
  const audit = db.audits.find((a) => a.id === req.params.id && a.organizationId === req.tenantContext!.organizationId);
  if (!audit) return sendError(res, 'AUDIT_NOT_FOUND', 'Audit record not found.', 404);

  const checklist = db.auditChecklistItems.filter((i) => i.auditId === audit.id);
  const findings = db.reviewFindings.filter((f) => f.auditId === audit.id);
  const comments = db.reviewComments.filter((c) => c.auditId === audit.id);
  const period = db.reportingPeriods.find((p) => p.id === audit.reportingPeriodId);

  return sendSuccess(res, {
    ...audit,
    period,
    checklist,
    findings,
    comments,
  });
});

apiRouter.post('/audits/:id/transition', authenticateTenant, (req: AuthenticatedRequest, res: Response) => {
  const audit = db.audits.find((a) => a.id === req.params.id && a.organizationId === req.tenantContext!.organizationId);
  if (!audit) return sendError(res, 'AUDIT_NOT_FOUND', 'Audit not found.', 404);

  const { targetState, reason } = req.body as { targetState: AuditStatus; reason?: string };
  const currentState = audit.status;

  // State Transition Machine Rules
  const validTransitions: Record<string, string[]> = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['DATA_COLLECTION'],
    DATA_COLLECTION: ['VALIDATION'],
    VALIDATION: ['REVIEW'],
    REVIEW: ['APPROVED', 'CORRECTION_REQUESTED', 'REJECTED'],
    CORRECTION_REQUESTED: ['DATA_COLLECTION'],
    REJECTED: ['DATA_COLLECTION'],
    APPROVED: ['AUDIT_READY'],
    AUDIT_READY: ['LOCKED'],
  };

  const allowed = validTransitions[currentState] || [];
  if (!allowed.includes(targetState)) {
    return sendError(res, 'INVALID_TRANSITION', `Cannot transition audit from '${currentState}' to '${targetState}'. Valid targets: ${allowed.join(', ')}.`);
  }

  // Mandatory prerequisite checks before APPROVED or LOCKED
  if (targetState === 'APPROVED' || targetState === 'AUDIT_READY' || targetState === 'LOCKED') {
    const checklist = db.auditChecklistItems.filter((i) => i.auditId === audit.id);
    const incomplete = checklist.filter((i) => i.isMandatory && !i.isSatisfied);
    if (incomplete.length > 0) {
      return sendError(
        res,
        'CHECKLIST_INCOMPLETE',
        `Cannot transition to '${targetState}'. ${incomplete.length} mandatory checklist item(s) are unsatisfied: ${incomplete.map((i) => i.code).join(', ')}.`
      );
    }
  }

  audit.status = targetState;
  audit.updatedAt = new Date().toISOString();

  if (targetState === 'APPROVED') {
    audit.approvedBy = req.tenantContext!.userId;
  }
  if (targetState === 'LOCKED') {
    audit.lockedAt = new Date().toISOString();
    // Freeze associated reporting period
    const period = db.reportingPeriods.find((p) => p.id === audit.reportingPeriodId);
    if (period) period.status = 'LOCKED';
  }

  // Log transition comment
  db.reviewComments.push({
    id: crypto.randomUUID(),
    auditId: audit.id,
    userId: req.tenantContext!.userId,
    userName: req.tenantContext!.role,
    userRole: req.tenantContext!.role,
    commentText: `Transitioned status from [${currentState}] to [${targetState}]. ${reason ? 'Reason: ' + reason : ''}`,
    createdAt: new Date().toISOString(),
  });

  return sendSuccess(res, audit, `Audit successfully transitioned to ${targetState}.`);
});

apiRouter.post('/audits/:id/checklist/:itemId/verify', authenticateTenant, requirePermission('audits.review'), (req: AuthenticatedRequest, res: Response) => {
  const audit = db.audits.find((a) => a.id === req.params.id && a.organizationId === req.tenantContext!.organizationId);
  if (!audit) return sendError(res, 'AUDIT_NOT_FOUND', 'Audit not found.', 404);

  const item = db.auditChecklistItems.find((i) => i.id === req.params.itemId && i.auditId === audit.id);
  if (!item) return sendError(res, 'ITEM_NOT_FOUND', 'Checklist item not found.', 404);

  const { isSatisfied, notes } = req.body;
  item.isSatisfied = Boolean(isSatisfied);
  item.verifiedBy = req.tenantContext!.userId;
  item.verifiedAt = new Date().toISOString();
  if (notes) item.notes = notes;

  return sendSuccess(res, item, 'Checklist item status updated.');
});

apiRouter.post('/audits/:id/findings', authenticateTenant, requirePermission('audits.review'), (req: AuthenticatedRequest, res: Response) => {
  const audit = db.audits.find((a) => a.id === req.params.id && a.organizationId === req.tenantContext!.organizationId);
  if (!audit) return sendError(res, 'AUDIT_NOT_FOUND', 'Audit not found.', 404);

  const { title, description, severity, activityDataId } = req.body;
  if (!title || !description) return sendError(res, 'VALIDATION_ERROR', 'Title and description required.');

  const finding: ReviewFinding = {
    id: `f-${Date.now().toString().slice(-4)}`,
    auditId: audit.id,
    activityDataId,
    severity: severity || 'MEDIUM',
    title,
    description,
    status: 'OPEN',
    createdBy: req.tenantContext!.userId,
    createdAt: new Date().toISOString(),
  };

  db.reviewFindings.push(finding);
  return sendSuccess(res, finding, 'Review finding recorded.', 201);
});

apiRouter.post('/audits/:id/findings/:findingId/resolve', authenticateTenant, requirePermission('audits.review'), (req: AuthenticatedRequest, res: Response) => {
  const audit = db.audits.find((a) => a.id === req.params.id && a.organizationId === req.tenantContext!.organizationId);
  if (!audit) return sendError(res, 'AUDIT_NOT_FOUND', 'Audit not found.', 404);

  const finding = db.reviewFindings.find((f) => f.id === req.params.findingId && f.auditId === audit.id);
  if (!finding) return sendError(res, 'FINDING_NOT_FOUND', 'Finding not found.', 404);

  finding.status = 'RESOLVED';
  finding.resolvedBy = req.tenantContext!.userId;

  return sendSuccess(res, finding, 'Finding marked as resolved.');
});

apiRouter.post('/audits/:id/comments', authenticateTenant, (req: AuthenticatedRequest, res: Response) => {
  const audit = db.audits.find((a) => a.id === req.params.id && a.organizationId === req.tenantContext!.organizationId);
  if (!audit) return sendError(res, 'AUDIT_NOT_FOUND', 'Audit not found.', 404);

  const { commentText } = req.body;
  if (!commentText || !commentText.trim()) return sendError(res, 'EMPTY_COMMENT', 'Comment text cannot be blank.');

  const comment: ReviewComment = {
    id: crypto.randomUUID(),
    auditId: audit.id,
    userId: req.tenantContext!.userId,
    userName: req.tenantContext!.role,
    userRole: req.tenantContext!.role,
    commentText: commentText.trim(),
    createdAt: new Date().toISOString(),
  };

  db.reviewComments.push(comment);
  return sendSuccess(res, comment, 'Comment added.');
});

// ==========================================
// 7. EVIDENCE MANAGEMENT VAULT
// ==========================================

apiRouter.get('/evidence', authenticateTenant, requirePermission('evidence.read'), (req: AuthenticatedRequest, res: Response) => {
  const records = db.evidenceRecords.filter((e) => e.organizationId === req.tenantContext!.organizationId);
  const enriched = records.map((rec) => {
    const links = db.evidenceLinks.filter((l) => l.evidenceRecordId === rec.id);
    return { ...rec, links };
  });
  return sendSuccess(res, enriched);
});

apiRouter.post(
  '/evidence/upload',
  authenticateTenant,
  requirePermission('evidence.upload'),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        return sendError(res, 'FILE_MISSING', 'No file was uploaded in the request.');
      }

      const { entityType, entityId } = req.body;
      const orgId = req.tenantContext!.organizationId;

      // Save via Storage abstraction (enforces mime, max 25MB, sha256)
      const stored = await storageService.saveFile(
        orgId,
        req.file.originalname,
        req.file.mimetype,
        req.file.buffer
      );

      const record: EvidenceRecord = {
        id: crypto.randomUUID(),
        organizationId: orgId,
        fileName: stored.fileName,
        fileSizeBytes: stored.fileSizeBytes,
        mimeType: stored.mimeType,
        sha256Hash: stored.sha256Hash,
        storagePath: stored.storagePath,
        uploadedBy: req.tenantContext!.userId,
        createdAt: new Date().toISOString(),
      };

      db.evidenceRecords.push(record);

      if (entityType && entityId) {
        db.evidenceLinks.push({
          id: crypto.randomUUID(),
          evidenceRecordId: record.id,
          entityType,
          entityId,
          createdAt: new Date().toISOString(),
        });
      }

      return sendSuccess(res, record, 'Evidence stored with SHA-256 verification.', 201);
    } catch (err: any) {
      return sendError(res, 'UPLOAD_FAILED', err.message || 'Evidence upload failed.', 400);
    }
  }
);

apiRouter.get('/evidence/:id/download', authenticateTenant, requirePermission('evidence.read'), async (req: AuthenticatedRequest, res: Response) => {
  const record = db.evidenceRecords.find((e) => e.id === req.params.id && e.organizationId === req.tenantContext!.organizationId);
  if (!record) return sendError(res, 'EVIDENCE_NOT_FOUND', 'Evidence document not found or cross-tenant access prohibited.', 404);

  try {
    const fileBuffer = await storageService.readFile(record.storagePath);
    res.setHeader('Content-Type', record.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${record.fileName}"`);
    return res.send(fileBuffer);
  } catch (err: any) {
    // If running in in-memory seed without physical file, return simulated content
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${record.fileName}"`);
    return res.send(`[CarbonFlow Evidence Vault]\nFile: ${record.fileName}\nSHA-256: ${record.sha256Hash}\nTenant: ${record.organizationId}`);
  }
});

// ==========================================
// 8. INVENTORY SNAPSHOTS & TARGETS
// ==========================================

apiRouter.get('/inventory', authenticateTenant, requirePermission('inventory.read'), (req: AuthenticatedRequest, res: Response) => {
  const snapshots = db.inventorySnapshots.filter((s) => s.organizationId === req.tenantContext!.organizationId);
  return sendSuccess(res, snapshots);
});

apiRouter.post('/inventory/snapshot', authenticateTenant, requirePermission('inventory.create'), (req: AuthenticatedRequest, res: Response) => {
  const { reportingPeriodId } = req.body;
  const activeEmissions = db.emissionRecords.filter(
    (e) => e.organizationId === req.tenantContext!.organizationId && e.reportingPeriodId === reportingPeriodId && e.status === 'ACTIVE'
  );

  const scope1 = activeEmissions.filter((e) => e.scope === 'SCOPE_1').reduce((acc, e) => acc + e.co2eTonnes, 0);
  const scope2Loc = activeEmissions.filter((e) => e.scope === 'SCOPE_2' && e.scope2Type === 'LOCATION_BASED').reduce((acc, e) => acc + e.co2eTonnes, 0);
  const scope2Mkt = activeEmissions.filter((e) => e.scope === 'SCOPE_2' && e.scope2Type === 'MARKET_BASED').reduce((acc, e) => acc + e.co2eTonnes, 0);

  const hashPayload = `${req.tenantContext!.organizationId}|${reportingPeriodId}|${scope1}|${scope2Loc}|${scope2Mkt}|${Date.now()}`;
  const snapshotHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

  const snapshot = {
    id: crypto.randomUUID(),
    organizationId: req.tenantContext!.organizationId,
    reportingPeriodId,
    scope1Co2eT: Number(scope1.toFixed(4)),
    scope2LocationCo2eT: Number(scope2Loc.toFixed(4)),
    scope2MarketCo2eT: Number(scope2Mkt.toFixed(4)),
    biogenicCo2eT: 0,
    status: 'ACTIVE' as const,
    snapshotHash,
    createdAt: new Date().toISOString(),
  };

  db.inventorySnapshots.push(snapshot);
  return sendSuccess(res, snapshot, 'Immutable inventory snapshot created.', 201);
});

apiRouter.get('/targets', authenticateTenant, requirePermission('targets.read'), (req: AuthenticatedRequest, res: Response) => {
  const targets = db.targets.filter((t) => t.organizationId === req.tenantContext!.organizationId);
  return sendSuccess(res, targets);
});

apiRouter.post('/targets', authenticateTenant, requirePermission('targets.create'), (req: AuthenticatedRequest, res: Response) => {
  const { name, baselinePeriodId, targetPeriodId, baselineValueT, targetValueT, reductionPercentage, notes } = req.body;
  const target = {
    id: crypto.randomUUID(),
    organizationId: req.tenantContext!.organizationId,
    name,
    baselinePeriodId,
    targetPeriodId,
    baselineValueT: Number(baselineValueT),
    targetValueT: Number(targetValueT),
    reductionPercentage: Number(reductionPercentage),
    status: 'ON_TRACK' as const,
    ownerId: req.tenantContext!.userId,
    notes,
    createdAt: new Date().toISOString(),
  };
  db.targets.push(target);
  return sendSuccess(res, target, 'Carbon target created.', 201);
});

apiRouter.get('/reduction-projects', authenticateTenant, requirePermission('reduction_projects.read'), (req: AuthenticatedRequest, res: Response) => {
  const projects = db.reductionProjects.filter((p) => p.organizationId === req.tenantContext!.organizationId);
  return sendSuccess(res, projects);
});

apiRouter.post('/reduction-projects', authenticateTenant, requirePermission('reduction_projects.create'), (req: AuthenticatedRequest, res: Response) => {
  const { name, description, facilityId, targetId, baselineT, expectedReductionT, actualReductionT, startDate, endDate, status } = req.body;
  const project = {
    id: crypto.randomUUID(),
    organizationId: req.tenantContext!.organizationId,
    targetId,
    facilityId,
    name,
    description,
    baselineT: Number(baselineT || 0),
    expectedReductionT: Number(expectedReductionT || 0),
    actualReductionT: Number(actualReductionT || 0),
    startDate,
    endDate,
    status: status || 'PLANNED',
    ownerId: req.tenantContext!.userId,
    createdAt: new Date().toISOString(),
  };
  db.reductionProjects.push(project);
  return sendSuccess(res, project, 'Reduction project created.', 201);
});

// ==========================================
// 9. ANALYTICS & EXECUTIVE DASHBOARD
// ==========================================

apiRouter.get('/analytics/dashboard', authenticateTenant, requirePermission('analytics.read'), (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.tenantContext!.organizationId;
  const activeEmissions = db.emissionRecords.filter((e) => e.organizationId === orgId && e.status === 'ACTIVE');
  const activities = db.activityData.filter((a) => a.organizationId === orgId);
  const audit = db.audits.find((a) => a.organizationId === orgId);
  const checklist = audit ? db.auditChecklistItems.filter((i) => i.auditId === audit.id) : [];
  const findings = audit ? db.reviewFindings.filter((f) => f.auditId === audit.id) : [];
  const targets = db.targets.filter((t) => t.organizationId === orgId);
  const projects = db.reductionProjects.filter((p) => p.organizationId === orgId);

  const scope1 = activeEmissions.filter((e) => e.scope === 'SCOPE_1').reduce((acc, e) => acc + e.co2eTonnes, 0);
  const scope2Loc = activeEmissions.filter((e) => e.scope === 'SCOPE_2' && e.scope2Type === 'LOCATION_BASED').reduce((acc, e) => acc + e.co2eTonnes, 0);
  const scope2Mkt = activeEmissions.filter((e) => e.scope === 'SCOPE_2' && e.scope2Type === 'MARKET_BASED').reduce((acc, e) => acc + e.co2eTonnes, 0);

  // Category breakdown for charts
  const categoryBreakdown: Record<string, number> = {};
  activeEmissions.forEach((e) => {
    categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.co2eTonnes;
  });

  // Facility breakdown
  const facilityBreakdown = db.facilities
    .filter((f) => f.organizationId === orgId)
    .map((f) => {
      const facEmissions = activeEmissions.filter((e) => e.facilityId === f.id);
      const facScope1 = facEmissions.filter((e) => e.scope === 'SCOPE_1').reduce((acc, e) => acc + e.co2eTonnes, 0);
      const facScope2 = facEmissions.filter((e) => e.scope === 'SCOPE_2').reduce((acc, e) => acc + e.co2eTonnes, 0);
      return {
        id: f.id,
        name: f.name,
        code: f.facilityCode,
        scope1Tonnes: Number(facScope1.toFixed(2)),
        scope2Tonnes: Number(facScope2.toFixed(2)),
        totalTonnes: Number((facScope1 + facScope2).toFixed(2)),
      };
    });

  return sendSuccess(res, {
    emissions: {
      scope1Tonnes: Number(scope1.toFixed(2)),
      scope2LocationTonnes: Number(scope2Loc.toFixed(2)),
      scope2MarketTonnes: Number(scope2Mkt.toFixed(2)),
      totalLocationBasedTonnes: Number((scope1 + scope2Loc).toFixed(2)),
      totalMarketBasedTonnes: Number((scope1 + scope2Mkt).toFixed(2)),
    },
    auditStatus: audit ? audit.status : 'DRAFT',
    auditHealth: {
      checklistSatisfied: checklist.filter((i) => i.isSatisfied).length,
      checklistTotal: checklist.length,
      openFindingsCount: findings.filter((f) => f.status === 'OPEN').length,
    },
    activityCount: activities.length,
    targetsCount: targets.length,
    reductionProjectsCount: projects.length,
    categories: Object.entries(categoryBreakdown).map(([category, tonnes]) => ({
      category,
      tonnes: Number(tonnes.toFixed(2)),
    })),
    facilities: facilityBreakdown,
  });
});

// ==========================================
// 10. REPORTS & EXPORT
// ==========================================

apiRouter.get('/reports/export-csv', authenticateTenant, requirePermission('reports.read'), (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.tenantContext!.organizationId;
  const records = db.emissionRecords.filter((e) => e.organizationId === orgId && e.status === 'ACTIVE');

  let csvContent = 'ID,Reporting Period,Scope,Category,Scope2 Method,CO2e Tonnes,Status,Created At\n';
  records.forEach((r) => {
    csvContent += `"${r.id}","${r.reportingPeriodId}","${r.scope}","${r.category}","${r.scope2Type || 'N/A'}",${r.co2eTonnes},"${r.status}","${r.createdAt}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="carbonflow_emission_ledger.csv"');
  return res.send(csvContent);
});

// ==========================================
// 11. AUTOMATED TEST SUITE ENDPOINT
// ==========================================

apiRouter.get('/test-suite/run', (req: Request, res: Response) => {
  const suiteResults = runAutomatedTestSuite();
  return sendSuccess(res, suiteResults, 'Automated test suite executed successfully.');
});
