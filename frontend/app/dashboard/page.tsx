'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AnalyticsView from '@/components/dashboard/AnalyticsView';
import SessionsPanel from '@/components/dashboard/SessionsPanel';
import { logout, me } from '@/lib/api';
import type { User } from '@/lib/types';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    me()
      .then((u) => {
        setUser(u);
        setLoading(false);
        if (u?.role !== 'support_agent' && u?.role !== 'admin') {
          router.replace('/chat');
        }
      })
      .catch(() => {
        setLoading(false);
        router.replace('/login');
      });
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-500 text-sm">
        Loading…
      </main>
    );
  }

  if (user?.role !== 'support_agent' && user?.role !== 'admin') {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-slate-900">Support access only</h1>
          <p className="mt-2 text-sm text-slate-600">
            The dashboard is available to support agents and admins.
          </p>
          <button
            onClick={() => router.push('/chat')}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Back to chat
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Support dashboard</h1>
          <p className="text-sm text-slate-500">Signed in as {user.email}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/chat')}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Live chat
          </button>
          <button
            onClick={() => { logout(); router.replace('/login'); }}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <SessionsPanel />
        <AnalyticsView />
      </div>
    </main>
  );
}