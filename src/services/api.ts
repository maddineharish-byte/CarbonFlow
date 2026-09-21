/**
 * CarbonFlow — Client API Service
 * Handles Bearer token headers, consistent response envelopes, and error mapping.
 */

let currentAccessToken: string | null = localStorage.getItem('cf_access_token');

export function setAccessToken(token: string | null) {
  currentAccessToken = token;
  if (token) {
    localStorage.setItem('cf_access_token', token);
  } else {
    localStorage.removeItem('cf_access_token');
  }
}

export function getAccessToken(): string | null {
  return currentAccessToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  if (currentAccessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${currentAccessToken}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api/v1${endpoint}`, {
    ...options,
    headers,
  });

  const json = await response.json();
  if (!response.ok || !json.success) {
    const errorMsg = json.error?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return json.data as T;
}

export const api = {
  // Auth
  login: (email: string, password: string, organizationId?: string) =>
    request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, organizationId }),
    }),

  switchTenantOrRole: (targetOrgId: string, targetRole: string, userId?: string) =>
    request<any>('/auth/switch-tenant-or-role', {
      method: 'POST',
      body: JSON.stringify({ targetOrgId, targetRole, userId }),
    }),

  getMe: () => request<any>('/auth/me'),

  // Organizations & Facilities
  getCurrentOrg: () => request<any>('/organizations/current'),
  updateCurrentOrg: (data: any) =>
    request<any>('/organizations/current', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getFacilities: () => request<any[]>('/facilities'),
  createFacility: (data: any) =>
    request<any>('/facilities', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getReportingPeriods: () => request<any[]>('/reporting-periods'),
  createReportingPeriod: (data: any) =>
    request<any>('/reporting-periods', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Reference Data
  getGwpSets: () => request<any[]>('/reference/gwp-sets'),
  getEmissionFactors: () => request<any[]>('/reference/emission-factors'),

  // Activity Data & Calculations
  getActivityData: (params?: { periodId?: string; facilityId?: string; scope?: string }) => {
    const query = new URLSearchParams();
    if (params?.periodId) query.set('periodId', params.periodId);
    if (params?.facilityId) query.set('facilityId', params.facilityId);
    if (params?.scope) query.set('scope', params.scope);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<any[]>(`/activity-data${qs}`);
  },
  createActivityData: (data: any) =>
    request<any>('/activity-data', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  runCalculation: (activityDataId: string, factorVersionId?: string, gwpSetId?: string) =>
    request<any>('/calculations/run', {
      method: 'POST',
      body: JSON.stringify({ activityDataId, factorVersionId, gwpSetId }),
    }),
  batchRunCalculations: (reportingPeriodId?: string) =>
    request<any>('/calculations/batch-run', {
      method: 'POST',
      body: JSON.stringify({ reportingPeriodId }),
    }),

  // Emissions
  getEmissions: (periodId?: string) => {
    const qs = periodId ? `?periodId=${periodId}` : '';
    return request<any>(`/emissions${qs}`);
  },

  // Audits & Assurance
  getAudits: () => request<any[]>('/audits'),
  getAuditDetail: (id: string) => request<any>(`/audits/${id}`),
  transitionAudit: (id: string, targetState: string, reason?: string) =>
    request<any>(`/audits/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ targetState, reason }),
    }),
  verifyChecklistItem: (auditId: string, itemId: string, isSatisfied: boolean, notes?: string) =>
    request<any>(`/audits/${auditId}/checklist/${itemId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ isSatisfied, notes }),
    }),
  createFinding: (auditId: string, data: any) =>
    request<any>(`/audits/${auditId}/findings`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  resolveFinding: (auditId: string, findingId: string) =>
    request<any>(`/audits/${auditId}/findings/${findingId}/resolve`, {
      method: 'POST',
    }),
  addAuditComment: (auditId: string, commentText: string) =>
    request<any>(`/audits/${auditId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ commentText }),
    }),

  // Evidence Management
  getEvidence: () => request<any[]>('/evidence'),
  uploadEvidence: async (file: File, entityType?: string, entityId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (entityType) formData.append('entityType', entityType);
    if (entityId) formData.append('entityId', entityId);

    const headers: Record<string, string> = {};
    if (currentAccessToken) {
      headers['Authorization'] = `Bearer ${currentAccessToken}`;
    }

    const response = await fetch('/api/v1/evidence/upload', {
      method: 'POST',
      headers,
      body: formData,
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.error?.message || 'Evidence upload failed.');
    }
    return json.data;
  },

  // Inventory & Targets
  getInventory: () => request<any[]>('/inventory'),
  createInventorySnapshot: (reportingPeriodId: string) =>
    request<any>('/inventory/snapshot', {
      method: 'POST',
      body: JSON.stringify({ reportingPeriodId }),
    }),
  getTargets: () => request<any[]>('/targets'),
  createTarget: (data: any) =>
    request<any>('/targets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getReductionProjects: () => request<any[]>('/reduction-projects'),
  createReductionProject: (data: any) =>
    request<any>('/reduction-projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Analytics & Reports
  getDashboardAnalytics: () => request<any>('/analytics/dashboard'),
  getTestSuiteResults: () => request<any>('/test-suite/run'),
};
