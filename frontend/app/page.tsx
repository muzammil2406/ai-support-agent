import Link from 'next/link';

const FEATURES = [
  {
    title: 'AI agent with tools',
    description:
      'A LangGraph ReAct agent that checks real order data, searches the FAQ knowledge base by meaning, and escalates to a human — through visible tool calls.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m13.5-6.5-2 2m-7 7-2 2m11 0-2-2m-7-7-2-2" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    accent: 'from-indigo-500 to-violet-500',
  },
  {
    title: 'Live streaming chat',
    description:
      'Responses stream token-by-token over WebSockets with live indicators as the agent checks your order or searches the knowledge base.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    title: 'Human escalation',
    description:
      'Frustrated or complex? The agent hands the exact transcript to your team and opens a support ticket automatically.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm18 0h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-5Z" />
        <path d="M4 11V9a8 8 0 0 1 16 0v2" />
      </svg>
    ),
    accent: 'from-amber-500 to-orange-500',
  },
  {
    title: 'Support dashboard',
    description:
      'Monitor active and escalated sessions live, resolve chats, and view analytics — resolution time per category and top escalation reasons.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M3 3v18h18" />
        <path d="M7 15v3m4-8v8m4-12v12m4-7v7" />
      </svg>
    ),
    accent: 'from-sky-500 to-blue-500',
  },
];

const CHAT_PREVIEW = [
  { role: 'user', text: 'Where is my order ORD-1002?' },
  { role: 'tool', text: 'Checking your order · ORD-1002' },
  {
    role: 'bot',
    text: 'Your order ORD-1002 has shipped and contains 3 items with a total of $149.50.',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-slate-50 to-white">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Nav */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/30">
              <Sparkle className="h-5 w-5 text-white" />
            </span>
            <span className="text-sm font-bold uppercase tracking-widest text-slate-700">
              Aurora
            </span>
          </div>
          <nav className="flex gap-2">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500"
            >
              Create account
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="mt-16 grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live on free hosting
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Customer support, powered by an{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                AI agent
              </span>{' '}
              that knows when to call a human.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Aurora answers instantly, checks real order data, searches a
              knowledge base by meaning, and hands off to your team the moment
              a customer needs a human.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:brightness-110"
              >
                Start a conversation
              </Link>
              <a
                href="/api/health"
                className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Backend health
              </a>
            </div>
          </div>

          {/* Chat preview mockup */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-indigo-200/50 to-violet-200/50 blur-2xl" />
            <div className="relative rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-indigo-900/10">
              <div className="flex items-center gap-2 rounded-t-3xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30">
                  <Sparkle className="h-3.5 w-3.5 text-white" />
                </span>
                <span className="text-sm font-semibold text-white">Aurora</span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-50">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  Online
                </span>
              </div>
              <div className="space-y-3 px-4 py-5">
                <div className="flex justify-end">
                  <div className="rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-medium text-white shadow-md shadow-indigo-600/20">
                    Where is my order ORD-1002?
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pl-1">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-medium text-indigo-600">
                    Checking your order
                  </span>
                </div>
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs leading-relaxed text-slate-700">
                    Your order ORD-1002 has shipped and contains 3 items with a
                    total of <span className="font-semibold">$149.50</span>.
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:240ms]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mt-24 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-900/5"
            >
              <span
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.accent} text-white shadow-lg`}
              >
                {f.icon}
              </span>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                {f.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {f.description}
              </p>
            </div>
          ))}
        </section>

        {/* CTA */}
        <section className="mt-24 overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-12 text-center shadow-xl shadow-indigo-600/25">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Try Aurora with your own account
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-indigo-100">
            Create an account, open a chat, and ask about ORD-1002. Support
            staff can try the live dashboard and escalation flow.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-indigo-700 shadow-lg transition hover:bg-indigo-50"
          >
            Get started free
          </Link>
        </section>

        <footer className="mt-16 border-t border-slate-200 pt-6 text-center text-sm text-slate-400">
          Aurora · Stellar Goods demo — Next.js · NestJS · LangGraph · pgvector ·
          MongoDB · Upstash Redis
        </footer>
      </div>
    </main>
  );
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l1.9 5.7a2 2 0 001.3 1.3L21 11l-5.8 2a2 2 0 00-1.3 1.3L12 20l-1.9-5.7a2 2 0 00-1.3-1.3L3 11l5.8-2a2 2 0 001.3-1.3L12 2z" />
    </svg>
  );
}
