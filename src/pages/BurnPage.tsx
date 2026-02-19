import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame,
  ArrowLeft,
  Check,
  X,
  RefreshCw,
  GitMerge,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Pencil,
  SkipForward,
  Square,
  Copy,
} from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { useBeads, useReadyBeads, useUpdateBead } from '../hooks/useBeads';
import { useJobs, useRetryJob } from '../hooks/useJobs';
import {
  useDrainStatus,
  useDrainPreview,
  useDrainSummary,
  useStartDrain,
  useStopDrain,
  useDrainPRStatuses,
  useMergePR,
  useUpdateChecklist,
} from '../hooks/useDrain';
import type { Bead, Job, DrainSummaryJob, PRStatus } from '../lib/types';

// ---------- Constants ----------

const PRIORITY_LABEL: Record<number, string> = { 0: 'P0', 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4' };
const PRIORITY_COLOR: Record<number, string> = {
  0: 'bg-red-500/20 text-red-400',
  1: 'bg-orange-500/20 text-orange-400',
  2: 'bg-yellow-500/20 text-yellow-400',
  3: 'bg-blue-500/20 text-blue-400',
  4: 'bg-text-muted/20 text-text-muted',
};

type FailureTier = 1 | 2 | 3;

const CATEGORY_TIER: Record<string, { tier: FailureTier; label: string }> = {
  compile_error:      { tier: 1, label: 'Retryable' },
  test_failure:       { tier: 1, label: 'Retryable' },
  agent_timeout:      { tier: 1, label: 'Retryable' },
  dep_install:        { tier: 1, label: 'Retryable' },
  server_restart:     { tier: 1, label: 'Retryable' },
  push_large_file:    { tier: 1, label: 'Retryable' },
  sandbox_rate_limit: { tier: 2, label: 'Check & Retry' },
  sandbox_creation:   { tier: 2, label: 'Check & Retry' },
  oom:                { tier: 2, label: 'Check & Retry' },
  push_auth:          { tier: 3, label: 'Needs Attention' },
  clone_failed:       { tier: 3, label: 'Needs Attention' },
  sandbox_auth:       { tier: 3, label: 'Needs Attention' },
  agent_token_limit:  { tier: 3, label: 'Needs Attention' },
  unknown:            { tier: 3, label: 'Needs Attention' },
};

const TIER_STYLE: Record<FailureTier, { badge: string }> = {
  1: { badge: 'bg-green-500/20 text-green-400' },
  2: { badge: 'bg-yellow-500/20 text-yellow-400' },
  3: { badge: 'bg-red-500/20 text-red-400' },
};

type PRDisplayStatus = 'merged' | 'ready' | 'ci_failing' | 'has_conflicts' | 'review_requested' | 'open';

const PR_BADGE: Record<PRDisplayStatus, { label: string; className: string }> = {
  merged:            { label: 'Merged',           className: 'bg-text-muted/20 text-text-muted' },
  ready:             { label: 'Ready to merge',   className: 'bg-green-500/20 text-green-400' },
  ci_failing:        { label: 'CI failing',       className: 'bg-yellow-500/20 text-yellow-400' },
  has_conflicts:     { label: 'Has conflicts',    className: 'bg-red-500/20 text-red-400' },
  review_requested:  { label: 'Review requested', className: 'bg-blue-500/20 text-blue-400' },
  open:              { label: 'Open',             className: 'bg-surface text-text-muted' },
};

// ---------- Helpers ----------

function getPRDisplayStatus(pr: PRStatus): PRDisplayStatus {
  if (pr.state === 'merged') return 'merged';
  if (pr.state === 'closed') return 'merged';
  if (pr.mergeable === false) return 'has_conflicts';
  if (pr.ciStatus === 'failure') return 'ci_failing';
  if (pr.reviewStatus === 'changes_requested') return 'review_requested';
  if (pr.mergeable && pr.ciStatus === 'success') return 'ready';
  if (pr.reviewStatus === 'pending') return 'review_requested';
  return 'open';
}

function parseChecklistItems(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*[-*\d.)\]]+\s*/, '').trim())
    .filter((line) => line.length > 0);
}

interface FailureGroup {
  category: string;
  tier: FailureTier;
  tierLabel: string;
  failureTitle: string;
  jobs: DrainSummaryJob[];
}

function buildFailureGroups(failedJobs: DrainSummaryJob[]): FailureGroup[] {
  const byCategory = new Map<string, DrainSummaryJob[]>();
  for (const job of failedJobs) {
    const cat = job.failureCategory || 'unknown';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(job);
  }
  const groups: FailureGroup[] = [];
  for (const [category, jobs] of byCategory) {
    const tierInfo = CATEGORY_TIER[category] || { tier: 3 as FailureTier, label: 'Needs Attention' };
    groups.push({
      category,
      tier: tierInfo.tier,
      tierLabel: tierInfo.label,
      failureTitle: jobs[0].failureTitle || category.replace(/_/g, ' '),
      jobs,
    });
  }
  groups.sort((a, b) => a.tier - b.tier || b.jobs.length - a.jobs.length);
  return groups;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

// ---------- Phase Components ----------

function SelectPhase({
  readyBeads,
  allBeads,
  selectedIds,
  onToggle,
  onAutoSelect,
  onSelectAll,
  onClear,
  onBegin,
  autoPickCount,
  isStarting,
}: {
  readyBeads: Bead[];
  allBeads: Bead[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onAutoSelect: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onBegin: () => void;
  autoPickCount: number;
  isStarting: boolean;
}) {
  const [filter, setFilter] = useState('');

  // Show ready beads, plus pending beads with pre-instructions (may be blocked)
  const candidates = useMemo(() => {
    const readySet = new Set(readyBeads.map((b) => b.id));
    const extra = allBeads.filter(
      (b) =>
        b.status === 'pending' &&
        b.preInstructions &&
        !readySet.has(b.id)
    );
    return [...readyBeads, ...extra].sort(
      (a, b) => a.priority - b.priority || a.subject.localeCompare(b.subject)
    );
  }, [readyBeads, allBeads]);

  const readySet = useMemo(() => new Set(readyBeads.map((b) => b.id)), [readyBeads]);

  const filtered = useMemo(
    () =>
      filter
        ? candidates.filter((b) => b.subject.toLowerCase().includes(filter.toLowerCase()))
        : candidates,
    [candidates, filter]
  );

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-text text-center mb-8 tracking-tight">
          SELECT YOUR TARGETS
        </h1>

        {/* Quick actions */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={onAutoSelect}
            className="px-3 py-1.5 rounded text-sm bg-surface-raised border border-surface-border text-text hover:bg-surface-border/30 transition-colors"
          >
            Auto-pick ({autoPickCount})
          </button>
          <button
            onClick={onSelectAll}
            className="px-3 py-1.5 rounded text-sm bg-surface-raised border border-surface-border text-text hover:bg-surface-border/30 transition-colors"
          >
            All ready ({readyBeads.length})
          </button>
          <button
            onClick={onClear}
            className="px-3 py-1.5 rounded text-sm bg-surface-raised border border-surface-border text-text-muted hover:bg-surface-border/30 transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Bead list */}
        <div className="rounded-lg border border-surface-border bg-surface-raised overflow-hidden">
          {/* Filter */}
          <div className="border-b border-surface-border px-3 py-2">
            <input
              type="text"
              placeholder="Filter..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-transparent text-sm text-text placeholder:text-text-muted outline-none"
            />
          </div>

          {/* List */}
          <div className="max-h-[50vh] overflow-y-auto divide-y divide-surface-border/30">
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-text-muted">
                {candidates.length === 0
                  ? 'No beads with pre-instructions found'
                  : 'No matches'}
              </div>
            )}
            {filtered.map((bead) => {
              const isReady = readySet.has(bead.id);
              const isSelected = selectedIds.has(bead.id);
              return (
                <label
                  key={bead.id}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface/50 transition-colors ${
                    isSelected ? 'bg-accent/5' : ''
                  } ${!isReady ? 'opacity-50' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(bead.id)}
                    className="sr-only"
                  />
                  <div
                    className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-accent border-accent text-white'
                        : 'border-surface-border hover:border-accent/50'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex-shrink-0 ${
                      PRIORITY_COLOR[bead.priority] || PRIORITY_COLOR[2]
                    }`}
                  >
                    {PRIORITY_LABEL[bead.priority] || 'P?'}
                  </span>
                  <span className="text-sm text-text truncate">{bead.subject}</span>
                  {!isReady && (
                    <span className="text-[10px] text-orange-400 flex-shrink-0">blocked</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {/* BEGIN BURN */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            onClick={onBegin}
            disabled={selectedIds.size === 0 || isStarting}
            className="px-8 py-3 rounded-lg bg-accent hover:bg-accent-light text-white font-bold text-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isStarting ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Flame className="w-5 h-5" />
            )}
            BEGIN BURN ({selectedIds.size})
          </button>
        </div>
      </div>
    </div>
  );
}

function BurningPhase({
  projectId,
  jobs,
  beadMap,
  onAbort,
  burnStartedAt,
  isStopping,
}: {
  projectId: string;
  jobs: Job[];
  beadMap: Map<string, Bead>;
  onAbort: () => void;
  burnStartedAt: number | null;
  isStopping: boolean;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const [queuedCollapsed, setQueuedCollapsed] = useState(false);

  const running = useMemo(() => jobs.filter((j) => j.status === 'running'), [jobs]);
  const queued = useMemo(() => jobs.filter((j) => j.status === 'queued'), [jobs]);
  const done = useMemo(
    () => jobs.filter((j) => j.status === 'completed').sort(
      (a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime()
    ),
    [jobs]
  );
  const failed = useMemo(() => jobs.filter((j) => j.status === 'failed'), [jobs]);

  const total = jobs.length;
  const remaining = queued.length + running.length;
  const progressPct = total > 0 ? ((total - remaining) / total) * 100 : 0;

  const elapsed = burnStartedAt ? Date.now() - burnStartedAt : 0;

  // Suppress unused tick warning — tick forces re-render for running timers
  void tick;

  return (
    <div className="min-h-screen bg-surface px-6 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Flame className="w-7 h-7 text-accent animate-pulse" />
          <h1 className="text-2xl font-bold text-text tracking-tight">BURNING</h1>
          {burnStartedAt && (
            <span className="text-sm text-text-muted font-mono">{formatElapsed(elapsed)}</span>
          )}
        </div>
        <button
          onClick={onAbort}
          disabled={isStopping}
          className="px-4 py-2 rounded bg-surface-raised border border-surface-border text-text-muted hover:text-accent hover:border-accent/50 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
        >
          {isStopping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
          ABORT
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="h-4 rounded-full bg-surface-raised border border-surface-border overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${progressPct}%`,
              background: `linear-gradient(90deg, #dc2626 0%, ${progressPct > 80 ? '#22c55e' : '#dc2626'} 100%)`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-text-muted">
          <span>
            <span className="text-green-400">{done.length} done</span>
            {' · '}
            <span className="text-yellow-400">{running.length} running</span>
            {' · '}
            <span className="text-red-400">{failed.length} failed</span>
            {' · '}
            <span className="text-blue-400">{queued.length} queued</span>
          </span>
          <span className="font-mono text-text">{remaining} remaining</span>
        </div>
      </div>

      {/* RUNNING */}
      {running.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-mono text-yellow-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            Running ({running.length})
          </h2>
          <div className="space-y-1">
            {running.map((job) => {
              const bead = job.bead_id ? beadMap.get(job.bead_id) : null;
              const jobElapsed = job.started_at
                ? Date.now() - new Date(job.started_at).getTime()
                : 0;
              return (
                <div key={job.id} className="flex items-center gap-3 py-2 px-3 rounded bg-surface-raised">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
                  <span className="text-sm text-text truncate flex-1">
                    {bead?.subject || job.prompt.slice(0, 60)}
                  </span>
                  <span className="text-xs font-mono text-text-muted flex-shrink-0">
                    {formatElapsed(jobElapsed)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* QUEUED */}
      {queued.length > 0 && (
        <section className="mt-6">
          <button
            onClick={() => setQueuedCollapsed(!queuedCollapsed)}
            className="text-xs font-mono text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-2 hover:text-blue-300 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
            Queued ({queued.length})
            {queued.length > 5 && (
              queuedCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
            )}
          </button>
          {!queuedCollapsed && (
            <div className="space-y-1">
              {queued.slice(0, 5).map((job) => {
                const bead = job.bead_id ? beadMap.get(job.bead_id) : null;
                return (
                  <div key={job.id} className="flex items-center gap-3 py-1.5 px-3 rounded">
                    <span className="w-2 h-2 rounded-full bg-text-muted/30 flex-shrink-0" />
                    <span className="text-sm text-text-muted truncate">
                      {bead?.subject || job.prompt.slice(0, 60)}
                    </span>
                  </div>
                );
              })}
              {queued.length > 5 && (
                <div className="text-xs text-text-muted px-3 py-1">
                  (+ {queued.length - 5} more)
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* DONE */}
      {done.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-mono text-green-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Check className="w-3 h-3" />
            Done ({done.length})
          </h2>
          <div className="space-y-1">
            {done.map((job) => {
              const bead = job.bead_id ? beadMap.get(job.bead_id) : null;
              const prUrl = job.result?.prUrl;
              const prMatch = prUrl?.match(/\/pull\/(\d+)/);
              return (
                <div key={job.id} className="flex items-center gap-3 py-1.5 px-3 rounded">
                  <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-text truncate flex-1">
                    {bead?.subject || job.prompt.slice(0, 60)}
                  </span>
                  {prUrl && (
                    <a
                      href={prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:text-accent-light flex items-center gap-1 flex-shrink-0"
                    >
                      PR {prMatch ? `#${prMatch[1]}` : ''} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* FAILED */}
      {failed.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-mono text-red-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <X className="w-3 h-3" />
            Failed ({failed.length})
          </h2>
          <div className="space-y-1">
            {failed.map((job) => {
              const bead = job.bead_id ? beadMap.get(job.bead_id) : null;
              const category = job.failureAnalysis?.category || 'unknown';
              return (
                <div key={job.id} className="flex items-center gap-3 py-1.5 px-3 rounded">
                  <X className="w-3 h-3 text-red-400 flex-shrink-0" />
                  <span className="text-sm text-text truncate flex-1">
                    {bead?.subject || job.prompt.slice(0, 60)}
                  </span>
                  <span className="text-xs font-mono text-text-muted flex-shrink-0">
                    {category.replace(/_/g, ' ')}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function ReviewPhase({
  projectId,
  drainId,
  totalElapsed,
  onNewBurn,
  onBack,
}: {
  projectId: string;
  drainId: string | undefined;
  totalElapsed: number;
  onNewBurn: () => void;
  onBack: () => void;
}) {
  const { data: summary } = useDrainSummary(projectId, true);
  const { data: prStatuses, isLoading: prLoading } = useDrainPRStatuses(projectId, drainId);
  const mergePR = useMergePR();
  const retryJob = useRetryJob();
  const updateBead = useUpdateBead();
  const updateChecklist = useUpdateChecklist();

  const [mergingPRs, setMergingPRs] = useState<Set<number>>(new Set());
  const [retryingJobIds, setRetryingJobIds] = useState<Set<string>>(new Set());
  const [skippedJobIds, setSkippedJobIds] = useState<Set<string>>(new Set());
  const [retryAllPending, setRetryAllPending] = useState(false);

  const completed = useMemo(() => summary?.jobs.filter((j) => j.status === 'completed') || [], [summary]);
  const failed = useMemo(
    () => summary?.jobs.filter((j) => j.status === 'failed' && !skippedJobIds.has(j.jobId)) || [],
    [summary, skippedJobIds]
  );
  const failureGroups = useMemo(() => buildFailureGroups(failed), [failed]);

  // PR status map
  const prStatusMap = useMemo(() => {
    const map = new Map<string, PRStatus>();
    if (prStatuses) {
      for (const pr of prStatuses) map.set(pr.jobId, pr);
    }
    return map;
  }, [prStatuses]);

  const readyPRs = useMemo(
    () => (prStatuses || []).filter((pr) => getPRDisplayStatus(pr) === 'ready'),
    [prStatuses]
  );

  // Checklist
  const checklistItems = useMemo(
    () => (summary?.smokeTestChecklist ? parseChecklistItems(summary.smokeTestChecklist) : []),
    [summary?.smokeTestChecklist]
  );
  const [localChecked, setLocalChecked] = useState<boolean[]>([]);

  useEffect(() => {
    if (checklistItems.length > 0 && localChecked.length !== checklistItems.length) {
      const next = summary?.checklistState || new Array(checklistItems.length).fill(false);
      setLocalChecked(next.slice(0, checklistItems.length));
    }
  }, [checklistItems.length]);

  const checkedCount = localChecked.filter(Boolean).length;

  // Handlers
  async function handleMergePR(prNumber: number) {
    setMergingPRs((prev) => new Set(prev).add(prNumber));
    try {
      await mergePR.mutateAsync({ projectId, prNumber });
    } finally {
      setMergingPRs((prev) => { const n = new Set(prev); n.delete(prNumber); return n; });
    }
  }

  async function handleBatchMerge() {
    for (const pr of readyPRs) await handleMergePR(pr.prNumber);
  }

  async function handleRetryJob(jobId: string) {
    setRetryingJobIds((prev) => new Set(prev).add(jobId));
    try {
      await retryJob.mutateAsync(jobId);
    } finally {
      setRetryingJobIds((prev) => { const n = new Set(prev); n.delete(jobId); return n; });
    }
  }

  async function handleRetryGroup(jobIds: string[]) {
    for (const id of jobIds) await handleRetryJob(id);
  }

  async function handleRetryAllFailed() {
    if (!failed.length) return;
    setRetryAllPending(true);
    try {
      await handleRetryGroup(failed.map((j) => j.jobId));
    } finally {
      setRetryAllPending(false);
    }
  }

  function handleSkip(job: DrainSummaryJob) {
    setSkippedJobIds((prev) => new Set(prev).add(job.jobId));
    if (job.beadId) {
      updateBead.mutate({ beadId: job.beadId, projectId, priority: 4 });
    }
  }

  function handleToggleCheck(index: number) {
    const next = [...localChecked];
    next[index] = !next[index];
    setLocalChecked(next);
    if (drainId) {
      updateChecklist.mutate({ projectId, drainId, checked: next });
    }
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-6 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Check className="w-7 h-7 text-green-400" />
          <h1 className="text-2xl font-bold text-text tracking-tight">BURN COMPLETE</h1>
        </div>
        <p className="text-sm text-text-muted">
          {summary.completedJobs} done · {summary.failedJobs} failed · {formatElapsed(totalElapsed)} elapsed
        </p>
      </div>

      {/* PR STATUS */}
      {completed.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-mono text-text-muted uppercase tracking-wider">PR Status</h2>
            {readyPRs.length > 0 && (
              <button
                onClick={handleBatchMerge}
                disabled={mergingPRs.size > 0}
                className="px-3 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <GitMerge className={`w-3 h-3 ${mergingPRs.size > 0 ? 'animate-spin' : ''}`} />
                Merge {readyPRs.length} ready
              </button>
            )}
          </div>
          <div className="rounded-lg border border-surface-border bg-surface-raised overflow-hidden divide-y divide-surface-border/30">
            {prLoading && (
              <div className="flex items-center gap-2 py-3 px-4 text-xs text-text-muted">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Loading PR statuses...
              </div>
            )}
            {completed.map((job) => {
              const pr = prStatusMap.get(job.jobId);
              const displayStatus = pr ? getPRDisplayStatus(pr) : null;
              const badge = displayStatus ? PR_BADGE[displayStatus] : null;
              const isMerging = pr ? mergingPRs.has(pr.prNumber) : false;

              return (
                <div key={job.jobId} className="flex items-center gap-3 py-2 px-4 text-sm">
                  <span className="text-text truncate flex-1">{job.subject}</span>
                  {job.prUrl && pr && badge && (
                    <>
                      <a
                        href={job.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:text-accent-light flex items-center gap-1 flex-shrink-0"
                      >
                        PR #{pr.prNumber} <ExternalLink className="w-3 h-3" />
                      </a>
                      <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] flex-shrink-0 ${badge.className}`}>
                        {badge.label}
                      </span>
                      {displayStatus === 'ready' && (
                        <button
                          onClick={() => handleMergePR(pr.prNumber)}
                          disabled={isMerging}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors flex items-center gap-1 disabled:opacity-50 flex-shrink-0"
                        >
                          <GitMerge className={`w-2.5 h-2.5 ${isMerging ? 'animate-spin' : ''}`} />
                          Merge
                        </button>
                      )}
                    </>
                  )}
                  {job.prUrl && !pr && !prLoading && (
                    <a
                      href={job.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:text-accent-light flex items-center gap-1 flex-shrink-0"
                    >
                      PR <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* FAILURES */}
      {failed.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-mono text-red-400 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" />
              Failures ({failed.length})
            </h2>
            <button
              onClick={handleRetryAllFailed}
              disabled={retryAllPending}
              className="px-3 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${retryAllPending ? 'animate-spin' : ''}`} />
              Retry {failed.length}
            </button>
          </div>
          <div className="space-y-2">
            {failureGroups.map((group) => (
              <FailureGroupCard
                key={group.category}
                group={group}
                onRetryJob={handleRetryJob}
                onRetryGroup={handleRetryGroup}
                onSkip={handleSkip}
                retryingJobIds={retryingJobIds}
              />
            ))}
          </div>
        </section>
      )}

      {/* SMOKE TEST CHECKLIST */}
      {summary.smokeTestChecklist ? (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-mono text-text-muted uppercase tracking-wider">Smoke Test Checklist</h2>
            <span className="text-xs text-text-muted">{checkedCount}/{checklistItems.length} checked</span>
          </div>
          <div className="rounded-lg border border-surface-border bg-surface-raised overflow-hidden divide-y divide-surface-border/30">
            {checklistItems.map((item, i) => (
              <label
                key={i}
                className="flex items-start gap-3 py-2.5 px-4 cursor-pointer hover:bg-surface/50 transition-colors"
              >
                <button
                  onClick={() => handleToggleCheck(i)}
                  className={`w-4 h-4 flex-shrink-0 mt-0.5 rounded border transition-colors ${
                    localChecked[i]
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-surface-border hover:border-green-500/50'
                  } flex items-center justify-center`}
                >
                  {localChecked[i] && <Check className="w-3 h-3" />}
                </button>
                <span className={`text-sm ${localChecked[i] ? 'text-text-muted line-through' : 'text-text'}`}>
                  {item}
                </span>
              </label>
            ))}
          </div>
        </section>
      ) : (
        <div className="mb-8 flex items-center gap-2 text-xs text-text-muted">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Generating smoke test checklist...
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-center gap-4 pt-4">
        <button
          onClick={onNewBurn}
          className="px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-white font-medium transition-colors flex items-center gap-2"
        >
          <Flame className="w-4 h-4" />
          New Burn
        </button>
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-lg bg-surface-raised border border-surface-border text-text hover:bg-surface-border/30 transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

function FailureGroupCard({
  group,
  onRetryJob,
  onRetryGroup,
  onSkip,
  retryingJobIds,
}: {
  group: FailureGroup;
  onRetryJob: (jobId: string) => void;
  onRetryGroup: (jobIds: string[]) => void;
  onSkip: (job: DrainSummaryJob) => void;
  retryingJobIds: Set<string>;
}) {
  const [expanded, setExpanded] = useState(group.tier <= 2);
  const style = TIER_STYLE[group.tier];
  const groupRetrying = group.jobs.some((j) => retryingJobIds.has(j.jobId));

  return (
    <div className="rounded-lg border border-surface-border bg-surface-raised overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 py-2 px-4 text-xs hover:bg-surface/50 transition-colors"
      >
        {expanded ? <ChevronUp className="w-3 h-3 text-text-muted" /> : <ChevronDown className="w-3 h-3 text-text-muted" />}
        <span className="font-mono text-text">{group.category.replace(/_/g, ' ')}</span>
        <span className="text-text-muted">— {group.jobs.length} job{group.jobs.length !== 1 ? 's' : ''}</span>
        <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${style.badge}`}>
          {group.tierLabel}
        </span>
        {group.tier <= 2 && (
          <button
            onClick={(e) => { e.stopPropagation(); onRetryGroup(group.jobs.map((j) => j.jobId)); }}
            disabled={groupRetrying}
            className={`ml-auto px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${style.badge} hover:opacity-80 disabled:opacity-50`}
          >
            <RefreshCw className={`w-2.5 h-2.5 ${groupRetrying ? 'animate-spin' : ''}`} />
            Retry {group.jobs.length}
          </button>
        )}
      </button>
      {expanded && (
        <div className="border-t border-surface-border/30 divide-y divide-surface-border/20">
          {group.jobs.map((job) => {
            const isRetrying = retryingJobIds.has(job.jobId);
            return (
              <div key={job.jobId} className="flex items-center gap-3 py-2 px-4 text-xs group">
                <span className="text-text truncate flex-1">{job.subject}</span>
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all flex-shrink-0">
                  <button
                    onClick={() => onRetryJob(job.jobId)}
                    disabled={isRetrying}
                    className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center gap-1 disabled:opacity-50"
                    title="Retry"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isRetrying ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => onSkip(job)}
                    className="px-1.5 py-0.5 rounded bg-text-muted/10 text-text-muted hover:bg-text-muted/20 flex items-center gap-1"
                    title="Skip (deprioritize to P4)"
                  >
                    <SkipForward className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Main Page Component ----------

export default function BurnPage() {
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const projectId = projects?.[0]?.id || '';

  // Phase state
  const [phase, setPhase] = useState<'select' | 'burning' | 'review'>('select');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeDrainId, setActiveDrainId] = useState<string | null>(null);
  const [burnStartedAt, setBurnStartedAt] = useState<number | null>(null);
  const prevDrainActive = useRef<boolean | undefined>(undefined);

  // Data hooks
  const { data: beads } = useBeads(projectId);
  const readyBeads = useReadyBeads(projectId);
  const { data: jobs } = useJobs(projectId);
  const { data: drainStatus } = useDrainStatus(projectId);
  const { data: preview } = useDrainPreview(projectId, 12);
  const { data: drainSummary } = useDrainSummary(projectId, phase === 'review');
  const startDrain = useStartDrain();
  const stopDrain = useStopDrain();

  const beadMap = useMemo(() => {
    const map = new Map<string, Bead>();
    if (beads) for (const b of beads) map.set(b.id, b);
    return map;
  }, [beads]);

  // Filter jobs for current drain
  const drainJobs = useMemo(() => {
    if (!jobs || !activeDrainId) return [];
    return jobs.filter((j) => j.drain_id === activeDrainId);
  }, [jobs, activeDrainId]);

  // Derive drain ID from active jobs (for reconnect)
  const derivedDrainId = useMemo(() => {
    if (activeDrainId) return activeDrainId;
    if (!jobs) return null;
    const activeJob = jobs.find((j) => (j.status === 'queued' || j.status === 'running') && j.drain_id);
    return activeJob?.drain_id || null;
  }, [jobs, activeDrainId]);

  // Reconnect: if drain is active on mount, skip to burning
  useEffect(() => {
    if (phase === 'select' && drainStatus?.active && derivedDrainId) {
      setActiveDrainId(derivedDrainId);
      setBurnStartedAt(drainStatus.startedAt ? new Date(drainStatus.startedAt).getTime() : Date.now());
      setPhase('burning');
    }
  }, [phase, drainStatus?.active, derivedDrainId]);

  // Auto-transition: burning → review when drain goes inactive
  useEffect(() => {
    if (phase === 'burning' && prevDrainActive.current === true && drainStatus?.active === false) {
      setPhase('review');
    }
    prevDrainActive.current = drainStatus?.active;
  }, [phase, drainStatus?.active]);

  // Selection handlers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const autoSelect = useCallback(() => {
    if (preview?.candidates) {
      setSelectedIds(new Set(preview.candidates.map((c) => c.id)));
    }
  }, [preview]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(readyBeads.map((b) => b.id)));
  }, [readyBeads]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Begin burn
  const handleBegin = useCallback(async () => {
    if (selectedIds.size === 0 || !projectId) return;
    try {
      const result = await startDrain.mutateAsync({
        projectId,
        beadIds: [...selectedIds],
      });
      // Find drain_id from newly created jobs
      const createdIds = new Set(result.jobsCreated);
      setBurnStartedAt(Date.now());
      setSelectedIds(new Set());
      setPhase('burning');
      // We'll pick up the drainId from jobs once they refresh
      // For now, set a placeholder that triggers derivedDrainId lookup
      const findDrainId = () => {
        const freshJobs = jobs || [];
        const match = freshJobs.find((j) => createdIds.has(j.id) && j.drain_id);
        if (match?.drain_id) {
          setActiveDrainId(match.drain_id);
        }
      };
      findDrainId();
      // Also try after a short delay for the query to refresh
      setTimeout(findDrainId, 2000);
    } catch (err) {
      console.error('Failed to start drain:', err);
    }
  }, [selectedIds, projectId, startDrain, jobs]);

  // Set drain ID from refreshed jobs (once available)
  useEffect(() => {
    if (phase === 'burning' && !activeDrainId && jobs) {
      const activeJob = jobs.find((j) => (j.status === 'queued' || j.status === 'running') && j.drain_id);
      if (activeJob?.drain_id) {
        setActiveDrainId(activeJob.drain_id);
      }
    }
  }, [phase, activeDrainId, jobs]);

  // Abort
  const handleAbort = useCallback(async () => {
    if (!projectId) return;
    try {
      await stopDrain.mutateAsync(projectId);
      setPhase('review');
    } catch (err) {
      console.error('Failed to stop drain:', err);
    }
  }, [projectId, stopDrain]);

  // New burn
  const handleNewBurn = useCallback(() => {
    setPhase('select');
    setActiveDrainId(null);
    setBurnStartedAt(null);
    setSelectedIds(new Set());
  }, []);

  // Back to dashboard
  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const totalElapsed = burnStartedAt ? Date.now() - burnStartedAt : 0;
  const reviewDrainId = activeDrainId || drainSummary?.drainId;

  // Back link (shown in select and burning phases)
  const backLink = phase !== 'review' && (
    <div className="fixed bottom-6 left-6">
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </button>
    </div>
  );

  return (
    <>
      {phase === 'select' && (
        <SelectPhase
          readyBeads={readyBeads}
          allBeads={beads || []}
          selectedIds={selectedIds}
          onToggle={toggleSelect}
          onAutoSelect={autoSelect}
          onSelectAll={selectAll}
          onClear={clearSelection}
          onBegin={handleBegin}
          autoPickCount={preview?.count || 0}
          isStarting={startDrain.isPending}
        />
      )}
      {phase === 'burning' && (
        <BurningPhase
          projectId={projectId}
          jobs={drainJobs.length > 0 ? drainJobs : (jobs || []).filter((j) => j.status === 'queued' || j.status === 'running' || j.drain_id === activeDrainId)}
          beadMap={beadMap}
          onAbort={handleAbort}
          burnStartedAt={burnStartedAt}
          isStopping={stopDrain.isPending}
        />
      )}
      {phase === 'review' && (
        <ReviewPhase
          projectId={projectId}
          drainId={reviewDrainId}
          totalElapsed={totalElapsed}
          onNewBurn={handleNewBurn}
          onBack={handleBack}
        />
      )}
      {backLink}
    </>
  );
}
