/**
 * CarbonFlow — Executive Dashboard View
 * Features strict Dual-Reporting presentation, GHG breakdown, and audit readiness health.
 */
import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  Building2,
  FileCheck,
  Flame,
  Zap,
  Camera,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { DashboardSummary } from '../types.ts';

interface DashboardViewProps {
  data: DashboardSummary | null;
  onNavigate: (view: any) => void;
  onSnapshot: () => void;
}

const COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899'];

export const DashboardView: React.FC<DashboardViewProps> = ({ data, onNavigate, onSnapshot }) => {
  if (!data) {
    return <div className="p-8 text-slate-400">Loading enterprise metrics...</div>;
  }

  const { emissions, auditStatus, auditHealth, categories, facilities } = data;

  return (
    <div className="space-y-6">
      {/* Top Banner: Dual-Reporting & Audit State */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight">GHG Accounting & Audit Readiness</h1>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                auditStatus === 'LOCKED'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : auditStatus === 'APPROVED'
                  ? 'bg-blue-950 text-blue-300 border-blue-800'
                  : 'bg-amber-950 text-amber-300 border-amber-800'
              }`}
            >
              CYCLE: {auditStatus}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            GHG Protocol Corporate Standard dual-reporting compliant. Scope 2 Location and Market-based
            emissions are reported separately to ensure non-aggregation integrity.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={onSnapshot}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow transition"
          >
            <Camera className="w-4 h-4" />
            Create Snapshot
          </button>
          <button
            onClick={() => onNavigate('AUDIT')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            <FileCheck className="w-4 h-4 text-sky-400" />
            Audit Room
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Scope 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Scope 1 Direct</span>
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {emissions.scope1Tonnes.toLocaleString()} <span className="text-xs font-normal text-slate-400">tCO₂e</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Stationary, mobile & fugitive leaks</div>
          </div>
        </div>

        {/* Scope 2 Location-Based */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Scope 2 (Location)</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-sky-400 tracking-tight">
              {emissions.scope2LocationTonnes.toLocaleString()}{' '}
              <span className="text-xs font-normal text-slate-400">tCO₂e</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Regional grid average emission factors</div>
          </div>
        </div>

        {/* Scope 2 Market-Based */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Scope 2 (Market)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-400 tracking-tight">
              {emissions.scope2MarketTonnes.toLocaleString()}{' '}
              <span className="text-xs font-normal text-slate-400">tCO₂e</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Supplier contracts & PPA certificates</div>
          </div>
        </div>

        {/* Audit Readiness Metric */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Audit Checklist</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {auditHealth.checklistSatisfied} / {auditHealth.checklistTotal}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
              {auditHealth.openFindingsCount > 0 ? (
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> {auditHealth.openFindingsCount} open finding(s)
                </span>
              ) : (
                <span className="text-emerald-400 font-medium">All findings resolved</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dual Reporting Highlight Box */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Dual-Reporting Totals (Non-Aggregated Presentation)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700/80">
            <div className="text-xs font-semibold text-slate-400">Total Emissions (Location-Based Approach)</div>
            <div className="text-3xl font-extrabold text-white mt-1">
              {emissions.totalLocationBasedTonnes.toLocaleString()}{' '}
              <span className="text-sm font-normal text-slate-400">tCO₂e</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-2">
              Formula: Scope 1 ({emissions.scope1Tonnes} t) + Scope 2 Location ({emissions.scope2LocationTonnes} t)
            </div>
          </div>

          <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700/80">
            <div className="text-xs font-semibold text-slate-400">Total Emissions (Market-Based Approach)</div>
            <div className="text-3xl font-extrabold text-emerald-400 mt-1">
              {emissions.totalMarketBasedTonnes.toLocaleString()}{' '}
              <span className="text-sm font-normal text-slate-400">tCO₂e</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-2">
              Formula: Scope 1 ({emissions.scope1Tonnes} t) + Scope 2 Market ({emissions.scope2MarketTonnes} t)
            </div>
          </div>
        </div>
      </div>

      {/* Analytical Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Facility Emissions Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-white">Facility Emissions Breakdown</div>
              <div className="text-xs text-slate-400">Scope 1 and Scope 2 split per reporting site</div>
            </div>
            <Building2 className="w-4 h-4 text-slate-500" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={facilities} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="code" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="scope1Tonnes" name="Scope 1 Direct" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="scope2Tonnes" name="Scope 2 Electricity" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Share Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-white">Emissions by Source Category</div>
              <div className="text-xs text-slate-400">Combustion, Electricity, Refrigerants</div>
            </div>
            <TrendingDown className="w-4 h-4 text-slate-500" />
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {categories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="tonnes"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry: any) => `${((entry.percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${val} tCO2e`, 'Emissions']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500">No emission category data found.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
