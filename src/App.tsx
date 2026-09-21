/**
 * CarbonFlow — Enterprise GHG Accounting & Audit SaaS Platform
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { BoundariesView } from './components/BoundariesView.tsx';
import { ActivityDataView } from './components/ActivityDataView.tsx';
import { EmissionsView } from './components/EmissionsView.tsx';
import { FactorsView } from './components/FactorsView.tsx';
import { AuditView } from './components/AuditView.tsx';
import { EvidenceView } from './components/EvidenceView.tsx';
import { TargetsView } from './components/TargetsView.tsx';
import { TestSuiteView } from './components/TestSuiteView.tsx';

import { api, setAccessToken } from './services/api.ts';
import {
  NavView,
  RoleName,
  Organization,
  User,
  Facility,
  ReportingPeriod,
  ActivityDataItem,
  AuditDetail,
  EvidenceRecord,
  TargetItem,
  ReductionProjectItem,
  DashboardSummary,
  AuditStatus,
} from './types.ts';

export default function App() {
  const [currentView, setCurrentView] = useState<NavView>('DASHBOARD');
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<RoleName>('COMPANY_ADMIN');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Core domain state
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [reportingPeriods, setReportingPeriods] = useState<ReportingPeriod[]>([]);
  const [activities, setActivities] = useState<ActivityDataItem[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [gwpSets, setGwpSets] = useState<any[]>([]);
  const [emissionFactors, setEmissionFactors] = useState<any[]>([]);
  const [currentAudit, setCurrentAudit] = useState<AuditDetail | null>(null);
  const [evidenceRecords, setEvidenceRecords] = useState<EvidenceRecord[]>([]);
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [reductionProjects, setReductionProjects] = useState<ReductionProjectItem[]>([]);
  const [testSuiteData, setTestSuiteData] = useState<any>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Load all tenant-scoped data
  const loadTenantData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [
        orgRes,
        facRes,
        periodsRes,
        activitiesRes,
        analyticsRes,
        gwpRes,
        efRes,
        auditsRes,
        evidenceRes,
        targetsRes,
        projectsRes,
      ] = await Promise.all([
        api.getCurrentOrg().catch(() => null),
        api.getFacilities().catch(() => []),
        api.getReportingPeriods().catch(() => []),
        api.getActivityData().catch(() => []),
        api.getDashboardAnalytics().catch(() => null),
        api.getGwpSets().catch(() => []),
        api.getEmissionFactors().catch(() => []),
        api.getAudits().catch(() => []),
        api.getEvidence().catch(() => []),
        api.getTargets().catch(() => []),
        api.getReductionProjects().catch(() => []),
      ]);

      if (orgRes) setCurrentOrg(orgRes);
      setFacilities(facRes);
      setReportingPeriods(periodsRes);
      setActivities(activitiesRes);
      setDashboardData(analyticsRes);
      setGwpSets(gwpRes);
      setEmissionFactors(efRes);
      setEvidenceRecords(evidenceRes);
      setTargets(targetsRes);
      setReductionProjects(projectsRes);

      // Load active audit detail
      if (auditsRes && auditsRes.length > 0) {
        const detail = await api.getAuditDetail(auditsRes[0].id).catch(() => null);
        setCurrentAudit(detail);
      } else {
        setCurrentAudit(null);
      }
    } catch (err: any) {
      console.error('Failed to load tenant data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial bootstrap: authenticate default admin persona
  useEffect(() => {
    const initAuth = async () => {
      try {
        const authData = await api.login('admin@acmeglobal.com', 'Password123!', 'org-tenant-a-1111');
        setAccessToken(authData.accessToken);
        setCurrentOrg(authData.organization);
        setCurrentUser(authData.user);
        setCurrentRole(authData.role);

        // Run automated tests in background to populate badge
        const suite = await api.getTestSuiteResults().catch(() => null);
        setTestSuiteData(suite);

        await loadTenantData();
      } catch (err) {
        console.error('Initial login failed:', err);
      }
    };
    initAuth();
  }, [loadTenantData]);

  // Switch Tenant (Tenant A vs Tenant B to test isolation)
  const handleSwitchTenant = async (orgId: string) => {
    try {
      setIsLoading(true);
      const authData = await api.switchTenantOrRole(orgId, currentRole, currentUser?.id);
      setAccessToken(authData.accessToken);
      setCurrentOrg(authData.organization);
      setCurrentRole(authData.role);
      await loadTenantData();
      showToast(`Switched to tenant: ${authData.organization.name}`);
    } catch (err: any) {
      showToast(err.message || 'Tenant switch failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Switch Role (test RBAC live across 9 canonical roles)
  const handleSwitchRole = async (role: RoleName) => {
    try {
      setIsLoading(true);
      const authData = await api.switchTenantOrRole(currentOrg?.id || 'org-tenant-a-1111', role, currentUser?.id);
      setAccessToken(authData.accessToken);
      setCurrentRole(role);
      showToast(`Role updated to ${role}`);
    } catch (err: any) {
      showToast(err.message || 'Role switch failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers for child views
  const handleUpdateOrg = async (data: Partial<Organization>) => {
    try {
      const updated = await api.updateCurrentOrg(data);
      setCurrentOrg(updated);
      showToast('Organizational boundaries saved.');
    } catch (err: any) {
      showToast(err.message || 'Update failed', 'error');
    }
  };

  const handleCreateFacility = async (data: any) => {
    try {
      await api.createFacility(data);
      await loadTenantData();
      showToast('Facility registered successfully.');
    } catch (err: any) {
      showToast(err.message || 'Facility creation failed', 'error');
    }
  };

  const handleAddActivity = async (data: any) => {
    try {
      await api.createActivityData(data);
      await loadTenantData();
      showToast('Activity record logged.');
    } catch (err: any) {
      showToast(err.message || 'Activity logging failed', 'error');
    }
  };

  const handleRunCalculation = async (activityId: string) => {
    try {
      await api.runCalculation(activityId);
      await loadTenantData();
      showToast('Deterministic calculation completed.');
    } catch (err: any) {
      showToast(err.message || 'Calculation failed', 'error');
    }
  };

  const handleBatchCalculate = async () => {
    try {
      const res = await api.batchRunCalculations();
      await loadTenantData();
      showToast(res.message || 'Batch calculation finished.');
    } catch (err: any) {
      showToast(err.message || 'Batch calculation failed', 'error');
    }
  };

  const handleCreateSnapshot = async () => {
    try {
      const periodId = reportingPeriods[0]?.id;
      if (!periodId) return;
      await api.createInventorySnapshot(periodId);
      showToast('Immutable inventory snapshot generated.');
    } catch (err: any) {
      showToast(err.message || 'Snapshot creation failed', 'error');
    }
  };

  const handleTransitionAudit = async (targetState: AuditStatus, reason?: string) => {
    if (!currentAudit) return;
    try {
      await api.transitionAudit(currentAudit.id, targetState, reason);
      const detail = await api.getAuditDetail(currentAudit.id);
      setCurrentAudit(detail);
      await loadTenantData();
      showToast(`Audit transitioned to ${targetState}`);
    } catch (err: any) {
      showToast(err.message || 'Audit transition failed', 'error');
    }
  };

  const handleVerifyChecklist = async (itemId: string, isSatisfied: boolean, notes?: string) => {
    if (!currentAudit) return;
    try {
      await api.verifyChecklistItem(currentAudit.id, itemId, isSatisfied, notes);
      const detail = await api.getAuditDetail(currentAudit.id);
      setCurrentAudit(detail);
      showToast('Checklist item updated.');
    } catch (err: any) {
      showToast(err.message || 'Verification failed', 'error');
    }
  };

  const handleCreateFinding = async (data: any) => {
    if (!currentAudit) return;
    try {
      await api.createFinding(currentAudit.id, data);
      const detail = await api.getAuditDetail(currentAudit.id);
      setCurrentAudit(detail);
      showToast('Review finding logged.');
    } catch (err: any) {
      showToast(err.message || 'Failed to log finding', 'error');
    }
  };

  const handleResolveFinding = async (findingId: string) => {
    if (!currentAudit) return;
    try {
      await api.resolveFinding(currentAudit.id, findingId);
      const detail = await api.getAuditDetail(currentAudit.id);
      setCurrentAudit(detail);
      showToast('Finding marked as resolved.');
    } catch (err: any) {
      showToast(err.message || 'Failed to resolve finding', 'error');
    }
  };

  const handleAddAuditComment = async (text: string) => {
    if (!currentAudit) return;
    try {
      await api.addAuditComment(currentAudit.id, text);
      const detail = await api.getAuditDetail(currentAudit.id);
      setCurrentAudit(detail);
      showToast('Comment added to audit record.');
    } catch (err: any) {
      showToast(err.message || 'Failed to add comment', 'error');
    }
  };

  const handleUploadEvidence = async (file: File) => {
    try {
      await api.uploadEvidence(file);
      await loadTenantData();
      showToast(`Uploaded ${file.name} with SHA-256 verification.`);
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
      throw err;
    }
  };

  const handleRunTestSuite = async () => {
    try {
      setIsLoading(true);
      const res = await api.getTestSuiteResults();
      setTestSuiteData(res);
      showToast(`Automated test suite complete: ${res.passed} passed, ${res.failed} failed.`);
    } catch (err: any) {
      showToast(err.message || 'Test suite failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Bar */}
      <Navbar
        currentOrg={currentOrg}
        currentUser={currentUser}
        currentRole={currentRole}
        onSwitchTenant={handleSwitchTenant}
        onSwitchRole={handleSwitchRole}
        onRefresh={loadTenantData}
        isLoading={isLoading}
      />

      {/* Main Layout */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          onSelectView={setCurrentView}
          auditBadge={currentAudit?.status}
          testPassedCount={testSuiteData?.passed}
        />

        {/* Content Area */}
        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {currentView === 'DASHBOARD' && (
            <DashboardView
              data={dashboardData}
              onNavigate={setCurrentView}
              onSnapshot={handleCreateSnapshot}
            />
          )}

          {currentView === 'BOUNDARIES' && (
            <BoundariesView
              org={currentOrg}
              facilities={facilities}
              onUpdateOrg={handleUpdateOrg}
              onCreateFacility={handleCreateFacility}
            />
          )}

          {currentView === 'ACTIVITY_DATA' && (
            <ActivityDataView
              activities={activities}
              facilities={facilities}
              periods={reportingPeriods}
              onAddActivity={handleAddActivity}
              onRunCalculation={handleRunCalculation}
              onBatchCalculate={handleBatchCalculate}
              onUploadEvidenceForActivity={() => setCurrentView('EVIDENCE')}
            />
          )}

          {currentView === 'EMISSIONS' && (
            <EmissionsView activities={activities} onRefresh={loadTenantData} />
          )}

          {currentView === 'FACTORS' && (
            <FactorsView gwpSets={gwpSets} emissionFactors={emissionFactors} />
          )}

          {currentView === 'AUDIT' && (
            <AuditView
              audit={currentAudit}
              currentRole={currentRole}
              onTransition={handleTransitionAudit}
              onVerifyChecklist={handleVerifyChecklist}
              onCreateFinding={handleCreateFinding}
              onResolveFinding={handleResolveFinding}
              onAddComment={handleAddAuditComment}
            />
          )}

          {currentView === 'EVIDENCE' && (
            <EvidenceView evidence={evidenceRecords} onUpload={handleUploadEvidence} />
          )}

          {currentView === 'TARGETS' && (
            <TargetsView targets={targets} projects={reductionProjects} />
          )}

          {currentView === 'TEST_SUITE' && (
            <TestSuiteView
              testSuiteData={testSuiteData}
              onRunTestSuite={handleRunTestSuite}
              isLoading={isLoading}
            />
          )}
        </main>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 z-50 border ${
            notification.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-emerald-800'
              : 'bg-rose-950 text-rose-200 border-rose-800'
          }`}
        >
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  );
}
