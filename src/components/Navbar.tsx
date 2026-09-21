/**
 * CarbonFlow — Executive Navigation Header
 * Features tenant switcher, canonical role switcher, and audit readiness status.
 */
import React from 'react';
import { Building2, ShieldCheck, UserCircle, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { RoleName, Organization, User } from '../types.ts';

interface NavbarProps {
  currentOrg: Organization | null;
  currentUser: User | null;
  currentRole: RoleName;
  onSwitchTenant: (orgId: string) => void;
  onSwitchRole: (role: RoleName) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

const ROLES_LIST: { role: RoleName; label: string }[] = [
  { role: 'COMPANY_ADMIN', label: 'Company Admin' },
  { role: 'SUSTAINABILITY_MANAGER', label: 'Sustainability Manager' },
  { role: 'CARBON_ACCOUNTANT', label: 'Carbon Accountant' },
  { role: 'DATA_OWNER', label: 'Data Owner' },
  { role: 'FACILITY_MANAGER', label: 'Facility Manager' },
  { role: 'REVIEWER', label: 'GHG Reviewer / Auditor' },
  { role: 'MANAGEMENT', label: 'Executive Management' },
  { role: 'ASSURANCE_PROVIDER', label: 'Assurance Provider (3P)' },
  { role: 'PLATFORM_ADMIN', label: 'Platform Admin' },
];

export const Navbar: React.FC<NavbarProps> = ({
  currentOrg,
  currentUser,
  currentRole,
  onSwitchTenant,
  onSwitchRole,
  onRefresh,
  isLoading,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold tracking-wider">
            CF
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              CarbonFlow
              <span className="text-[10px] uppercase font-semibold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                PRO Enterprise
              </span>
            </div>
            <div className="text-xs text-slate-400">GHG Protocol & ISO 14064-1 Compliant</div>
          </div>
        </div>

        {/* Tenant Switcher */}
        <div className="hidden md:flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
          <Building2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-slate-400 font-medium">Tenant:</span>
          <select
            id="tenant-switcher-select"
            value={currentOrg?.id || 'org-tenant-a-1111'}
            onChange={(e) => onSwitchTenant(e.target.value)}
            className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
          >
            <option value="org-tenant-a-1111" className="bg-slate-800 text-white">
              Acme Global Mfg (Tenant A)
            </option>
            <option value="org-tenant-b-2222" className="bg-slate-800 text-white">
              Vertex Tech Solutions (Tenant B)
            </option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Role Switcher */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
          <ShieldCheck className="w-4 h-4 text-sky-400" />
          <span className="text-xs text-slate-400 font-medium">Role:</span>
          <select
            id="role-switcher-select"
            value={currentRole}
            onChange={(e) => onSwitchRole(e.target.value as RoleName)}
            className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
          >
            {ROLES_LIST.map((r) => (
              <option key={r.role} value={r.role} className="bg-slate-800 text-white">
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Export Button */}
        <a
          href="/api/v1/reports/export-csv"
          download="carbonflow_ledger.csv"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
          title="Download full audited ledger as CSV"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          Export Ledger
        </a>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>

        {/* User profile chip */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800 text-xs text-slate-300">
          <UserCircle className="w-5 h-5 text-slate-400" />
          <span className="hidden lg:inline font-medium">{currentUser?.fullName || 'Active User'}</span>
        </div>
      </div>
    </header>
  );
};
