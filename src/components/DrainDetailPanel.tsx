import {
  ArrowLeft,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Ban,
  Circle,
  Calendar,
  ClipboardCheck,
  RefreshCw,
  Square,
} from 'lucide-react';
import { useDrainDetail } from '../hooks/useDrain';
import type { Job, JobStatus } from '../lib/types';

const DRAIN_STATUS_CONFIG: Record<string, { color: string; label: string; bg: string }> = {
  running: { color: 'text-yellow-400', label: 'Running', bg: 'bg-yellow-400/10' },
  completed: { color: 'text-green-400', label: 'Completed', bg: 'bg-green-400/10' },
  stopped: { color: 'text-text-muted', label: 'Stopped', bg: 'bg-text-muted/10' },
};

const JOB_STATUS_CONFIG: Record<JobStatus, { icon: typeof Circle; color: string }> = {
  queued: { icon: Clock, color: 'text-blue-400' },
  running: { icon: Play, color: 'text-yellow-400' },
  completed: { icon: CheckCircle2, color: 'text-green-400' },
  failed: { icon: XCircle, color: 'text-red-400' },
  cancelled: { icon: Ban, color: 'text-text-muted' },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString();
}

export function DrainDetailPanel({
  projectId,
  drainId,
  onBack,
  onClickJob,
}: {
  projectId: string;
  drainId: string;
  onBack: () => void;
  onClickJob: (jobId: string) => void;
}) {
  const { data: drain, isLoading } = useDrainDetail(projectId, drainId);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-surface-border flex items-center gap-2">
          <button
            onClick={onBack}
            className="text-text-muted hover:text-text transition-colors flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="w-5 h-5 text-text-muted animate-spin" />
        </div>
      </div>
    );
  }

  if (!drain) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-surface-border flex items-center gap-2">
          <button
            onClick={onBack}
            className="text-text-muted hover:text-text transition-colors flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
          Drain not found
        </div>
      </div>
    );
  }

  const statusConfig = DRAIN_STATUS_CONFIG[drain.status] || DRAIN_STATUS_CONFIG.stopped;

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
          Drain Detail
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <Zap className="w-4 h-4 text-accent" />
          <span className="text-base font-semibold text-text">Drain</span>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${statusConfig.bg}`}>
            {drain.status === 'running' ? (
              <RefreshCw className={`w-3.5 h-3.5 ${statusConfig.color} animate-spin`} />
            ) : drain.status === 'stopped' ? (
              <Square className={`w-3.5 h-3.5 ${statusConfig.color}`} />
            ) : (
              <CheckCircle2 className={`w-3.5 h-3.5 ${statusConfig.color}`} />
            )}
            <span className={`text-xs font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-text-muted">
            {drain.total_jobs} total
          </span>
          <span className="text-green-400">
            {drain.completed_jobs} completed
          </span>
          <span className="text-red-400">
            {drain.failed_jobs} failed
          </span>
          {drain.scope_size > 0 && (
            <span className="text-text-muted">
              {drain.scope_size} in scope
            </span>
          )}
        </div>

        {/* Timestamps */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-text-muted">Started:</span>
            <span className="text-text">{formatDate(drain.started_at)}</span>
          </div>
          {drain.completed_at && (
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-text-muted">
                {drain.status === 'stopped' ? 'Stopped:' : 'Completed:'}
              </span>
              <span className="text-text">{formatDate(drain.completed_at)}</span>
            </div>
          )}
        </div>

        {/* Jobs list */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Jobs ({drain.jobs?.length || 0})
          </h4>
          <div className="space-y-1">
            {drain.jobs?.map((job: Job) => {
              const jobConfig = JOB_STATUS_CONFIG[job.status];
              const JobIcon = jobConfig.icon;
              const result = job.result;
              return (
                <button
                  key={job.id}
                  onClick={() => onClickJob(job.id)}
                  className="w-full text-left flex items-center gap-2 p-2 bg-surface-raised/50 rounded hover:bg-surface-raised transition-colors"
                >
                  <JobIcon className={`w-3.5 h-3.5 flex-shrink-0 ${jobConfig.color}`} />
                  <span className="text-sm text-text truncate flex-1">
                    {job.prompt}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {result?.prUrl && (
                      <span className="text-xs text-accent">PR</span>
                    )}
                    {result?.testResults && (
                      <span className={`text-xs ${result.testResults.passed ? 'text-green-400' : 'text-red-400'}`}>
                        {result.testResults.passed ? 'pass' : 'fail'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Smoke test checklist */}
        {drain.smoke_test_checklist && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
              <ClipboardCheck className="w-3.5 h-3.5" />
              Smoke Test Checklist
            </h4>
            <div className="bg-surface-raised border border-surface-border rounded p-3">
              <div className="text-sm text-text whitespace-pre-wrap leading-relaxed">
                {drain.smoke_test_checklist}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
