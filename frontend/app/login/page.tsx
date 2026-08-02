'use client';

import { Suspense } from 'react';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { login, setAuth } from '@/lib/api';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { accessToken, user } = await login(email, password);
      setAuth(accessToken, user);
      const next = searchParams.get('next') ?? (user.role === 'customer' ? '/chat' : '/dashboard');
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
      setLoading(false);
    }
  }

  function fillDemo(role: 'customer' | 'support') {
    setEmail(role === 'customer' ? 'demo@stellar.dev' : 'support@stellar.dev');
    setPassword('password123');
    setError(null);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-100 via-slate-50 to-violet-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/30">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-white">
              <path d="M12 2l1.9 5.7a2 2 0 001.3 1.3L21 11l-5.8 2a2 2 0 00-1.3 1.3L12 20l-1.9-5.7a2 2 0 00-1.3-1.3L3 11l5.8-2a2 2 0 001.3-1.3L12 2z" />
            </svg>
          </span>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to Aurora support</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-indigo-900/5">
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-100">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          New here?{' '}
          <Link href="/register" className="font-semibold text-indigo-600 hover:underline">
            Create an account
          </Link>
        </p>

        <div className="mt-6 rounded-2xl border border-indigo-100 bg-white/70 p-4 text-xs text-slate-600 backdrop-blur">
          <p className="font-semibold text-slate-700">Quick demo login</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillDemo('customer')}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left transition hover:border-indigo-300 hover:bg-indigo-50"
            >
              <span className="block font-medium text-slate-700">Customer</span>
              <code className="font-mono text-[11px] text-slate-500">demo@stellar.dev</code>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('support')}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left transition hover:border-indigo-300 hover:bg-indigo-50"
            >
              <span className="block font-medium text-slate-700">Support</span>
              <code className="font-mono text-[11px] text-slate-500">support@stellar.dev</code>
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Password: <code className="font-mono">password123</code>
          </p>
        </div>
      </div>
    </main>
  );
}
