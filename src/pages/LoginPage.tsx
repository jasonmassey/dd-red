import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, AlertCircle } from 'lucide-react';
import { api, setToken } from '../lib/api';
import type { User } from '../lib/types';

export default function LoginPage() {
  const [token, setTokenInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) return;

    setError('');
    setLoading(true);

    // Temporarily set the token so api.get uses it
    setToken(trimmed);

    const res = await api.get<User>('/auth/me');
    if (res.success && res.data) {
      navigate('/');
    } else {
      // Clear invalid token
      localStorage.removeItem('dd_red_token');
      setError(res.error || 'Invalid token');
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            DD <span className="text-accent">Red</span>
          </h1>
          <p className="text-text-muted text-sm">
            Paste your dev-dash API token to connect.
          </p>
        </div>

        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="password"
                value={token}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="dd_xxxxxxxxxx..."
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 bg-surface-raised border border-surface-border rounded-lg text-text text-sm font-mono placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full py-2.5 bg-accent hover:bg-accent-light disabled:bg-accent-dim disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Connect'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-text-muted text-xs">
          Create a token in{' '}
          <a
            href="https://dev-dash-client.vercel.app/settings"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            dev-dash settings
          </a>
        </p>
      </div>
    </div>
  );
}
