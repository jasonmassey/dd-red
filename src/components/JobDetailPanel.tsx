import { useState } from 'react';
import {
  ArrowLeft,
  Circle,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  Ban,
  GitBranch,
  ExternalLink,
  Calendar,
  Terminal,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import type { Job, JobStatus, Bead } from '../lib/types';

const JOB_STATUS_CONFIG: Record<JobStatus, { icon: typeof Circle; color: string; label: string; bg: string }> = {
  queued: { icon: Clock, color: 'text-blue-400', label: 'Queued', bg: 'bg-blue-400/10' },
  running: { icon: Play, color: 'text-yellow-400', label: 'Running', bg: 'bg-yellow-400/10' },
  completed: { icon: CheckCircle2, color: 'text-green-400', label: 'Completed', bg: 'bg-green-400/10' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed', bg: 'bg-red-400/10' },
  cancelled: { icon: Ban, color: 'text-text-muted', label: 'Cancelled', bg: 'bg-text-muted/10' },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString();
}

function formatDuration(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
}

export function JobDetailPanel({
  job,
  bead,
  onBack,
  onClickBead,
  onRetry,
  isRetrying,
}: {
  job: Job;
  bead?: Bead | null;
  onBack: () => void;
  onClickBead?: (beadId: string) => void;
  onRetry?: (jobId: string) => void;
  isRetrying?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [logExpanded, setLogExpanded] = useState(false);

  const config = JOB_STATUS_CONFIG[job.status];
  const StatusIcon = config.icon;

  const handleCopyId = () => {
    navigator.clipboard.writeText(job.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const duration = job.result?.durationMs ? formatDuration(job.result.durationMs) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Back bar */}
      <div className="px-3 py-2 border-b border-surface-border flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-text-muted hover:text-text transition-colors flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <span className="text-xs font-mono text-text-muted uppercase tracking-wider ml-auto">
          Job Detail
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Status badge + ID */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${config.bg}`}>
            <StatusIcon className={`w-3.5 h-3.5 ${config.color}`} />
            <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
          </div>
          {duration && (
            <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 font-mono">
              {duration}
            </span>
          )}
          {job.status === 'running' && (
            <RefreshCw className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
          )}
          <button
            onClick={handleCopyId}
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded bg-surface-raised text-text-muted hover:text-text transition-colors"
            title="Copy job ID"
          >
            <span className="text-xs font-mono">{job.id.slice(0, 8)}</span>
            {copied ? (
              <Check className="w-3 h-3 text-green-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
          {job.status === 'failed' && onRetry && (
            <button
              onClick={() => onRetry(job.id)}
              disabled={isRetrying}
              className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              title="Retry this job"
            >
              <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
              <span className="text-xs font-medium">Retry</span>
            </button>
          )}
        </div>

        {/* Bead link */}
        {bead && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
              <GitBranch className="w-3.5 h-3.5" />
              Task
            </h4>
            <button
              onClick={() => onClickBead?.(bead.id)}
              className="w-full text-left p-2 bg-surface-raised/50 rounded hover:bg-surface-raised transition-colors"
            >
              <span className="text-sm text-accent hover:underline">{bead.subject}</span>
            </button>
          </div>
        )}

        {/* Prompt */}
        <div className="space-y-1.5">
          <h4 className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
            <Terminal className="w-3.5 h-3.5" />
            Prompt
          </h4>
          <div className="bg-surface-raised/50 rounded p-3">
            <p className="text-sm text-text whitespace-pre-wrap">{job.prompt}</p>
          </div>
        </div>

        {/* Result */}
        {job.result && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Result
            </h4>
            <div className="flex items-center gap-3 flex-wrap text-xs">
              {job.result.prUrl && (
                <a
                  href={job.result.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline flex items-center gap-1"
                >
                  <GitBranch className="w-3 h-3" />
                  View PR
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {job.result.testResults && (
                <span
                  className={`flex items-center gap-1 ${
                    job.result.testResults.passed ? 'text-green-400' : 'text-orange-400'
                  }`}
                >
                  {job.result.testResults.passed ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <XCircle className="w-3 h-3" />
                  )}
                  {job.result.testResults.summary}
                </span>
              )}
              {job.result.branchName && (
                <span className="text-text-muted font-mono">{job.result.branchName}</span>
              )}
            </div>
            {job.result.summary && (
              <div className="bg-surface-raised/50 rounded p-3 mt-2">
                <p className="text-sm text-text whitespace-pre-wrap">{job.result.summary}</p>
              </div>
            )}
          </div>
        )}

        {/* Failure analysis */}
        {job.failureAnalysis && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              Failure Analysis
            </h4>
            <div className="bg-red-500/5 border border-red-500/20 rounded p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-mono">
                  {job.failureAnalysis.category}
                </span>
                <span className="text-sm text-text font-medium">{job.failureAnalysis.title}</span>
              </div>
              <p className="text-sm text-text-muted">{job.failureAnalysis.summary}</p>
              {job.failureAnalysis.suggestions.length > 0 && (
                <ul className="text-sm text-text-muted list-disc list-inside space-y-0.5">
                  {job.failureAnalysis.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {job.error && !job.failureAnalysis && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              Error
            </h4>
            <div className="bg-red-500/5 border border-red-500/20 rounded p-3">
              <p className="text-sm text-red-400 font-mono whitespace-pre-wrap">{job.error}</p>
            </div>
          </div>
        )}

        {/* Output log (collapsible) */}
        {job.output_log && (
          <div className="space-y-1.5">
            <button
              onClick={() => setLogExpanded(!logExpanded)}
              className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider hover:text-text transition-colors"
            >
              {logExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <Terminal className="w-3.5 h-3.5" />
              Output Log
            </button>
            {logExpanded && (
              <div className="bg-surface-raised border border-surface-border rounded p-3 max-h-96 overflow-y-auto">
                <pre className="text-xs text-text font-mono whitespace-pre-wrap">{job.output_log}</pre>
              </div>
            )}
          </div>
        )}

        {/* Timestamps */}
        <div className="pt-3 border-t border-surface-border space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-text-muted">Created:</span>
            <span className="text-text">{formatDate(job.created_at)}</span>
          </div>
          {job.started_at && (
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-text-muted">Started:</span>
              <span className="text-text">{formatDate(job.started_at)}</span>
            </div>
          )}
          {job.completed_at && (
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-text-muted">Completed:</span>
              <span className="text-text">{formatDate(job.completed_at)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
