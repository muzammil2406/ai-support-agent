import Link from 'next/link';

const FEATURES = [
  {
    title: 'AI agent with tools',
    description:
      'A LangGraph ReAct agent that looks up order status, searches the FAQ knowledge base with pgvector, and escalates to a human — all through tool calls.',
  },
  {
    title: 'Live streaming chat',
    description:
      'Responses stream token-by-token over WebSockets so customers watch the assistant think in real time.',
  },
  {
    title: 'Human escalation',
    description:
      'Frustrated or complex? The agent hands the exact transcript to a human agent and opens a support ticket automatically.',
  },
  {
    title: 'Support dashboard',
    description:
      'Monitor active and escalated sessions live, and view analytics — average resolution time per category and top escalation reasons.',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
          <span className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Aurora
          </span>
        </div>
        <nav className="flex gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            Create account
          </Link>
        </nav>
      </header>

      <section className="mt-20 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          Customer support, powered by an{' '}
          <span className="text-indigo-600">AI agent</span> that knows when to
          call a human.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Aurora answers instantly, checks real order data, searches a
          knowledge base by meaning, and hands off to your team the moment a
          customer needs a human.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
          >
            Start a conversation
          </Link>
          <a
            href="/api/health"
            className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Backend health
          </a>
        </div>
      </section>

      <section className="mt-24 grid gap-6 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-slate-900">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {f.description}
            </p>
          </div>
        ))}
      </section>

      <footer className="mt-24 border-t border-slate-200 pt-6 text-center text-sm text-slate-400">
        Aurora · Stellar Goods demo — Next.js · NestJS · LangGraph · pgvector ·
        MongoDB · Upstash Redis
      </footer>
    </main>
  );
}
