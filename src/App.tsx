import { useEffect } from 'react';

const SITES = [
  'https://dev-dash-red.vercel.app',
  'https://dev-dash-yellow.vercel.app',
  'https://dev-dash-violet.vercel.app',
];

export default function App() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '~') {
        const current = SITES.findIndex(s => location.origin === s);
        window.location.href = SITES[(current + 1) % SITES.length];
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-mono mb-8">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          execution engine
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          DD <span className="text-accent">Red</span>
        </h1>
        <p className="text-xl text-text-muted mb-6">
          Your backlog works while you sleep.
        </p>
        <p className="text-text-muted leading-relaxed mb-10">
          Turn issues into executing agents. Decompose, dispatch, and deliver —
          automatically. DD Red is the execution engine that transforms your
          backlog from a list of wishes into a pipeline of running work.
        </p>
        <div className="grid grid-cols-3 gap-4 text-left">
          {[
            { label: 'Decompose', desc: 'Break big tasks into agent-sized chunks with dependency ordering' },
            { label: 'Dispatch', desc: 'Fire agents in parallel with rich project context and memory' },
            { label: 'Deliver', desc: 'PRs land, tests pass, failures auto-retry with learned context' },
          ].map((item) => (
            <div key={item.label} className="p-4 rounded-lg bg-surface-raised border border-surface-border">
              <div className="text-accent font-mono text-sm mb-2">{item.label}</div>
              <div className="text-sm text-text-muted">{item.desc}</div>
            </div>
          ))}
        </div>
        <div className="mt-12 text-text-muted text-sm font-mono">
          Part of the <a href="https://github.com/jasonmassey/dev-dash" className="text-accent hover:underline">dev-dash</a> platform
        </div>
      </div>
    </div>
  );
}
