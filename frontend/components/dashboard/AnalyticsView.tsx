'use client';

import { useEffect, useState } from 'react';
import { fetchAnalytics, formatDuration } from '@/lib/api';
import type { AnalyticsSummary } from '@/lib/types';

export default function AnalyticsView() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await fetchAnalytics();
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load analytics.');
      }
    };
    load();
    const poll = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, []);

  if (error) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-red-700 shadow-sm">
        {error}
      </section>
    );
  }

  const totals = data?.totals?.[0];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Analytics</h2>
        <p className="text-xs text-slate-400">
          Computed live from a Mongo aggregation pipeline ($facet)
        </p>
      </header>

      {!data ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-6 px-4 py-4">
          {/* Totals */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total sessions" value={totals?.totalSessions ?? 0} />
            <StatCard label="Escalated" value={totals?.escalated ?? 0} />
            <StatCard label="Resolved" value={totals?.resolved ?? 0} />
          </div>

          {/* Avg resolution time per category */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Avg resolution time per category
            </h3>
            {data.avgResolutionTimeByCategory.length === 0 ? (
              <p className="text-sm text-slate-400">No resolved sessions yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.avgResolutionTimeByCategory.map((row) => (
                  <li key={row._id}>
                    <div className="mb-0.5 flex justify-between text-xs">
                      <span className="font-medium capitalize text-slate-700">
                        {row._id}
                      </span>
                      <span className="text-slate-500">
                        {formatDuration(row.avgResolutionMs)} · {row.sessions} session
                        {row.sessions > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-indigo-500"
                        style={{
                          width: `${barWidth(row.avgResolutionMs, data.avgResolutionTimeByCategory)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Top escalation reasons */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Top escalation reasons
            </h3>
            {data.topEscalationReasons.length === 0 ? (
              <p className="text-sm text-slate-400">No escalations yet.</p>
            ) : (
              <ul className="space-y-1">
                {data.topEscalationReasons.map((r) => (
                  <li
                    key={r._id}
                    className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-amber-900">{r._id}</span>
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                      {r.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function barWidth(ms: number, all: AnalyticsSummary['avgResolutionTimeByCategory']): number {
  const max = Math.max(...all.map((r) => r.avgResolutionMs), 1);
  return Math.max(8, Math.round((ms / max) * 100));
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-center">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  );
}
