import { useState, useMemo } from 'react';
import {
  Play,
  Zap,
  Square,
  Circle,
  Clock,
  CheckCircle2,
  Lock,
  XCircle,
  GitBranch,
  ChevronDown,
  ChevronUp,
  LogOut,
  RefreshCw,
  Sparkles,
  Check,
  X,
  ExternalLink,
  ClipboardCheck,
  AlertTriangle,
  Ban,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../hooks/useProjects';
import { useBeads, useReadyBeads } from '../hooks/useBeads';
import { useJobs, useCreateJob, useRetryJob, useJobStats } from '../hooks/useJobs';
import { useDrainStatus, useDrainPreview, useDrainSummary, useStartDrain, useStopDrain } from '../hooks/useDrain';
import { BeadDetailPanel } from '../components/BeadDetailPanel';
import { JobDetailPanel } from '../components/JobDetailPanel';
import { DrainDetailPanel } from '../components/DrainDetailPanel';
import type { Bead, Job, BeadStatus, JobStatus, DrainSummary as DrainSummaryType, DrainSummaryJob } from '../lib/types';

// -- Right panel discriminated union --
type RightPanel =
  | { kind: 'feed' }
  | { kind: 'beadDetail'; beadId: string }
  | { kind: 'jobDetail'; jobId: string }
  | { kind: 'drainDetail'; drainId: string };

const STATUS_ICON: Record<BeadStatus, typeof Circle> = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
  blocked: Lock,
  failed: XCircle,
};

const STATUS_COLOR: Record<BeadStatus, string> = {
  pending: 'text-text-muted',
  in_progress: 'text-yellow-400',
  completed: 'text-green-400',
  blocked: 'text-orange-400',
  failed: 'text-red-400',
};

const PRIORITY_LABEL: Record<number, string> = {
  0: 'P0',
  1: 'P1',
  2: 'P2',
  3: 'P3',
  4: 'P4',
};

const PRIORITY_COLOR: Record<number, string> = {
  0: 'bg-red-500/20 text-red-400',
  1: 'bg-orange-500/20 text-orange-400',
  2: 'bg-yellow-500/20 text-yellow-400',
  3: 'bg-blue-500/20 text-blue-400',
  4: 'bg-text-muted/20 text-text-muted',
};

const JOB_DOT_COLOR: Record<JobStatus, string> = {
  running: 'bg-yellow-400 animate-pulse',
  queued: 'bg-blue-400',
  completed: 'bg-green-400',
  failed: 'bg-red-400',
  cancelled: 'bg-text-muted',
};

// -- Failure category tiers --
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

const TIER_STYLE: Record<FailureTier, { badge: string; text: string }> = {
  1: { badge: 'bg-green-500/20 text-green-400', text: 'text-green-400' },
  2: { badge: 'bg-yellow-500/20 text-yellow-400', text: 'text-yellow-400' },
  3: { badge: 'bg-red-500/20 text-red-400', text: 'text-red-400' },
};

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

  // Sort by tier (most actionable first), then by job count descending
  groups.sort((a, b) => a.tier - b.tier || b.jobs.length - a.jobs.length);
  return groups;
}

function buildBeadTree(beads: Bead[]) {
  const byId = new Map(beads.map((b) => [b.id, b]));
  const children = new Map<string | undefined, Bead[]>();

  for (const bead of beads) {
    const parent = bead.parentBeadId || undefined; // normalize null → undefined
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(bead);
  }

  // Sort children by priority then subject
  for (const [, kids] of children) {
    kids.sort((a, b) => a.priority - b.priority || a.subject.localeCompare(b.subject));
  }

  return { byId, children };
}

function BeadRow({
  bead,
  depth,
  children: childBeads,
  jobMap,
  readyIds,
  selectedIds,
  onToggleSelect,
  onDispatch,
  onInspect,
  dispatchingId,
}: {
  bead: Bead;
  depth: number;
  children: Map<string | undefined, Bead[]>;
  jobMap: Map<string, Job>;
  readyIds: Set<string>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onDispatch: (bead: Bead) => void;
  onInspect: (bead: Bead) => void;
  dispatchingId: string | null;
}) {
  const Icon = STATUS_ICON[bead.status];
  const isReady = readyIds.has(bead.id);
  const isSelected = selectedIds.has(bead.id);
  const activeJob = jobMap.get(bead.id);
  const kids = childBeads.get(bead.id) || [];

  return (
    <>
      <div
        className={`flex items-center gap-2 py-1.5 px-3 hover:bg-surface-raised/50 rounded group ${
          isReady ? 'border-l-2 border-green-500' : ''
        } ${isSelected ? 'bg-accent/5' : ''}`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {/* Selection checkbox for ready beads */}
        {isReady && !activeJob ? (
          <button
            onClick={() => onToggleSelect(bead.id)}
            className={`w-4 h-4 flex-shrink-0 rounded border transition-colors ${
              isSelected
                ? 'bg-accent border-accent text-white'
                : 'border-surface-border hover:border-accent/50'
            } flex items-center justify-center`}
          >
            {isSelected && <Check className="w-3 h-3" />}
          </button>
        ) : (
          <Icon className={`w-4 h-4 flex-shrink-0 ${STATUS_COLOR[bead.status]}`} />
        )}
        <span
          className="text-sm text-text truncate flex-1 cursor-pointer hover:text-accent transition-colors"
          onClick={() => onInspect(bead)}
        >
          {bead.subject}
        </span>
        <span
          className={`text-xs px-1.5 py-0.5 rounded font-mono ${
            PRIORITY_COLOR[bead.priority] || PRIORITY_COLOR[4]
          }`}
        >
          {PRIORITY_LABEL[bead.priority] ?? `P${bead.priority}`}
        </span>
        {activeJob && (
          <span
            className={`text-xs px-1.5 py-0.5 rounded font-mono ${
              activeJob.status === 'running'
                ? 'bg-yellow-500/20 text-yellow-400'
                : activeJob.status === 'queued'
                  ? 'bg-blue-500/20 text-blue-400'
                  : activeJob.status === 'completed'
                    ? 'bg-green-500/20 text-green-400'
                    : activeJob.status === 'failed'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-text-muted/20 text-text-muted'
            }`}
          >
            {activeJob.status}
          </span>
        )}
        {isReady && !activeJob && (
          <button
            onClick={() => onDispatch(bead)}
            disabled={dispatchingId === bead.id}
            className="opacity-0 group-hover:opacity-100 px-2 py-0.5 bg-accent/20 hover:bg-accent/30 text-accent text-xs rounded flex items-center gap-1 transition-opacity disabled:opacity-50"
          >
            <Play className="w-3 h-3" />
            Dispatch
          </button>
        )}
      </div>
      {kids.map((child) => (
        <BeadRow
          key={child.id}
          bead={child}
          depth={depth + 1}
          children={childBeads}
          jobMap={jobMap}
          readyIds={readyIds}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          onDispatch={onDispatch}
          onInspect={onInspect}
          dispatchingId={dispatchingId}
        />
      ))}
    </>
  );
}

// -- Enhanced Job Feed with drain grouping --

type FeedItem =
  | { kind: 'job'; job: Job }
  | { kind: 'drainGroup'; drainId: string; jobs: Job[] };

function groupJobsIntoDrainGroups(jobs: Job[]): FeedItem[] {
  const items: FeedItem[] = [];
  let currentDrainId: string | null = null;
  let currentDrainJobs: Job[] = [];

  for (const job of jobs) {
    if (job.drain_id) {
      if (job.drain_id === currentDrainId) {
        currentDrainJobs.push(job);
      } else {
        // Flush previous drain group
        if (currentDrainId && currentDrainJobs.length > 0) {
          items.push({ kind: 'drainGroup', drainId: currentDrainId, jobs: currentDrainJobs });
        }
        currentDrainId = job.drain_id;
        currentDrainJobs = [job];
      }
    } else {
      // Flush any pending drain group
      if (currentDrainId && currentDrainJobs.length > 0) {
        items.push({ kind: 'drainGroup', drainId: currentDrainId, jobs: currentDrainJobs });
        currentDrainId = null;
        currentDrainJobs = [];
      }
      items.push({ kind: 'job', job });
    }
  }

  // Flush remaining drain group
  if (currentDrainId && currentDrainJobs.length > 0) {
    items.push({ kind: 'drainGroup', drainId: currentDrainId, jobs: currentDrainJobs });
  }

  return items;
}

function JobCard({
  job,
  beadMap,
  onClick,
  indented,
}: {
  job: Job;
  beadMap: Map<string, Bead>;
  onClick: () => void;
  indented?: boolean;
}) {
  const bead = job.bead_id ? beadMap.get(job.bead_id) : null;
  const result = job.result;
  const duration = result?.durationMs ? `${Math.round(result.durationMs / 1000)}s` : null;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2 py-1.5 px-3 text-sm rounded hover:bg-surface-raised/50 transition-colors ${
        indented ? 'pl-6' : ''
      }`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${JOB_DOT_COLOR[job.status]}`} />
      <span className="text-text truncate flex-1">
        {bead ? bead.subject : job.prompt.slice(0, 60)}
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
        {duration && (
          <span className="text-xs text-text-muted font-mono">{duration}</span>
        )}
      </div>
    </button>
  );
}

function JobFeed({
  jobs,
  beadMap,
  onClickJob,
  onClickDrainGroup,
}: {
  jobs: Job[];
  beadMap: Map<string, Bead>;
  onClickJob: (jobId: string) => void;
  onClickDrainGroup: (drainId: string) => void;
}) {
  const recent = jobs.slice(0, 50);
  const feedItems = useMemo(() => groupJobsIntoDrainGroups(recent), [recent]);

  if (recent.length === 0) {
    return (
      <div className="text-text-muted text-sm text-center py-8">
        No jobs yet. Dispatch a bead to start.
      </div>
    );
  }

  return (
    <div className="space-y-0.5 py-1">
      {feedItems.map((item) => {
        if (item.kind === 'job') {
          return (
            <JobCard
              key={item.job.id}
              job={item.job}
              beadMap={beadMap}
              onClick={() => onClickJob(item.job.id)}
            />
          );
        }

        // Drain group
        const { drainId, jobs: drainJobs } = item;
        const completed = drainJobs.filter((j) => j.status === 'completed').length;
        const failed = drainJobs.filter((j) => j.status === 'failed').length;
        const running = drainJobs.filter((j) => j.status === 'running').length;

        return (
          <div key={`drain-${drainId}`} className="relative">
            {/* Left accent bracket */}
            <div className="absolute left-1 top-0 bottom-0 w-0.5 bg-accent/40 rounded-full" />

            {/* Drain header — clickable */}
            <button
              onClick={() => onClickDrainGroup(drainId)}
              className="w-full text-left flex items-center gap-2 py-1.5 px-3 pl-4 text-xs hover:bg-surface-raised/50 rounded transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-accent" />
              <span className="text-accent font-medium">Drain</span>
              <span className="text-text-muted">{drainJobs.length} jobs</span>
              <div className="flex items-center gap-2 ml-auto text-xs font-mono">
                {completed > 0 && <span className="text-green-400">{completed} ok</span>}
                {failed > 0 && <span className="text-red-400">{failed} fail</span>}
                {running > 0 && <span className="text-yellow-400">{running} run</span>}
              </div>
            </button>

            {/* Drain jobs (indented) */}
            {drainJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                beadMap={beadMap}
                onClick={() => onClickJob(job.id)}
                indented
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function SelectionReview({
  selectedIds,
  beads,
  onRemove,
  onClear,
  onInspect,
  collapsed,
  onToggleCollapse,
}: {
  selectedIds: Set<string>;
  beads: Bead[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onInspect: (bead: Bead) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const selected = beads.filter((b) => selectedIds.has(b.id));
  if (selected.length === 0) return null;

  // Sort by priority then subject
  selected.sort((a, b) => a.priority - b.priority || a.subject.localeCompare(b.subject));

  return (
    <div className="border-b border-accent/20 bg-surface-raised/50">
      <button
        onClick={onToggleCollapse}
        className="w-full px-4 py-2 flex items-center gap-2 text-sm hover:bg-surface-raised/80 transition-colors"
      >
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-accent" />
        ) : (
          <ChevronUp className="w-4 h-4 text-accent" />
        )}
        <span className="text-accent font-medium">{selected.length} tasks selected for drain</span>
        <span className="text-text-muted text-xs ml-2">
          {selected.filter((b) => b.priority <= 1).length} high priority
        </span>
        <span className="ml-auto text-text-muted text-xs hover:text-text" onClick={(e) => { e.stopPropagation(); onClear(); }}>
          Clear all
        </span>
      </button>
      {!collapsed && (
        <div className="px-4 pb-3 space-y-1 max-h-48 overflow-y-auto">
          {selected.map((bead) => (
            <div
              key={bead.id}
              className="flex items-center gap-2 py-1 px-2 rounded hover:bg-surface-raised group"
            >
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                  PRIORITY_COLOR[bead.priority] || PRIORITY_COLOR[4]
                }`}
              >
                {PRIORITY_LABEL[bead.priority] ?? `P${bead.priority}`}
              </span>
              <span
                className="text-sm text-text truncate flex-1 cursor-pointer hover:text-accent transition-colors"
                onClick={() => onInspect(bead)}
              >
                {bead.subject}
              </span>
              {bead.beadType && (
                <span className="text-xs text-text-muted">{bead.beadType}</span>
              )}
              <button
                onClick={() => onRemove(bead.id)}
                className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all"
                title="Remove from selection"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FailureCategoryGroup({
  group,
  onRetryGroup,
  onRetryJob,
  onClickJob,
  retryingJobIds,
}: {
  group: FailureGroup;
  onRetryGroup?: (jobIds: string[]) => void;
  onRetryJob?: (jobId: string) => void;
  onClickJob?: (jobId: string) => void;
  retryingJobIds: Set<string>;
}) {
  const canRetry = group.tier <= 2;
  const style = TIER_STYLE[group.tier];
  // Tier 3 collapsed by default
  const [expanded, setExpanded] = useState(group.tier <= 2);
  const groupRetrying = group.jobs.some((j) => retryingJobIds.has(j.jobId));

  return (
    <div className="border-l-2 border-surface-border/50 ml-2">
      {/* Group header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 py-1.5 px-3 text-xs hover:bg-surface-raised/80 transition-colors"
      >
        {expanded ? <ChevronUp className="w-3 h-3 text-text-muted" /> : <ChevronDown className="w-3 h-3 text-text-muted" />}
        <span className="font-mono text-text">{group.category.replace(/_/g, ' ')}</span>
        <span className="text-text-muted">— &quot;{group.failureTitle}&quot; — {group.jobs.length} job{group.jobs.length !== 1 ? 's' : ''}</span>
        <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${style.badge}`}>
          {group.tierLabel}
        </span>
        {canRetry && onRetryGroup && (
          <button
            onClick={(e) => { e.stopPropagation(); onRetryGroup(group.jobs.map((j) => j.jobId)); }}
            disabled={groupRetrying}
            className={`ml-auto px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
              style.badge
            } hover:opacity-80 disabled:opacity-50`}
          >
            <RefreshCw className={`w-2.5 h-2.5 ${groupRetrying ? 'animate-spin' : ''}`} />
            Retry {group.jobs.length}
          </button>
        )}
      </button>

      {/* Job list */}
      {expanded && (
        <div className="pl-6 pb-1">
          {group.jobs.map((job) => {
            const isRetrying = retryingJobIds.has(job.jobId);
            return (
              <div
                key={job.jobId}
                className="flex items-center gap-2 py-1 px-2 rounded text-xs hover:bg-surface/50 group"
              >
                <span
                  className="text-text truncate flex-1 cursor-pointer hover:text-accent transition-colors"
                  onClick={() => onClickJob?.(job.jobId)}
                >
                  {job.subject}
                </span>
                {onRetryJob && (
                  <button
                    onClick={() => onRetryJob(job.jobId)}
                    disabled={isRetrying}
                    className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all flex items-center gap-1 disabled:opacity-50"
                    title="Retry this job"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isRetrying ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DrainSummaryPanel({
  summary,
  onDismiss,
  onRetryJob,
  onRetryGroup,
  onRetryAllFailed,
  onClickJob,
  retryingJobIds,
  retryAllPending,
}: {
  summary: DrainSummaryType;
  onDismiss: () => void;
  onRetryJob?: (jobId: string) => void;
  onRetryGroup?: (jobIds: string[]) => void;
  onRetryAllFailed?: () => void;
  onClickJob?: (jobId: string) => void;
  retryingJobIds: Set<string>;
  retryAllPending: boolean;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [showFailed, setShowFailed] = useState(false);

  const completed = summary.jobs.filter((j) => j.status === 'completed');
  const failed = summary.jobs.filter((j) => j.status === 'failed');
  const failureGroups = useMemo(() => buildFailureGroups(failed), [failed]);

  return (
    <div className="bg-surface-raised border-b border-surface-border">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <ClipboardCheck className="w-5 h-5 text-green-400" />
        <span className="text-sm font-medium text-text">
          Drain Complete — {summary.completedJobs} completed, {summary.failedJobs} failed
        </span>
        <span className="text-xs text-text-muted">
          {new Date(summary.completedAt).toLocaleTimeString()}
        </span>
        <button
          onClick={onDismiss}
          className="ml-auto text-text-muted hover:text-text transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Completed jobs */}
      {completed.length > 0 && (
        <div className="border-t border-surface-border/50">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full px-4 py-2 flex items-center gap-2 text-xs hover:bg-surface-raised/80 transition-colors"
          >
            {showCompleted ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <CheckCircle2 className="w-3 h-3 text-green-400" />
            <span className="text-green-400">{completed.length} completed</span>
          </button>
          {showCompleted && (
            <div className="px-4 pb-3 space-y-1 max-h-48 overflow-y-auto">
              {completed.map((job) => (
                <div key={job.jobId} className="flex items-center gap-2 py-1 px-2 rounded text-xs hover:bg-surface/50">
                  <span
                    className="text-text truncate flex-1 cursor-pointer hover:text-accent transition-colors"
                    onClick={() => onClickJob?.(job.jobId)}
                  >
                    {job.subject}
                  </span>
                  {job.testResults && (
                    <span className={`px-1.5 py-0.5 rounded font-mono ${
                      job.testResults.passed ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {job.testResults.passed ? 'tests pass' : 'tests fail'}
                    </span>
                  )}
                  {job.prUrl && (
                    <a
                      href={job.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:text-accent/80 flex items-center gap-1"
                    >
                      PR <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Failed jobs — grouped by category */}
      {failed.length > 0 && (
        <div className="border-t border-surface-border/50">
          <button
            onClick={() => setShowFailed(!showFailed)}
            className="w-full px-4 py-2 flex items-center gap-2 text-xs hover:bg-surface-raised/80 transition-colors"
          >
            {showFailed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span className="text-red-400">{failed.length} failed</span>
            {onRetryAllFailed && (
              <button
                onClick={(e) => { e.stopPropagation(); onRetryAllFailed(); }}
                disabled={retryAllPending}
                className="ml-auto px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${retryAllPending ? 'animate-spin' : ''}`} />
                Re-drain {failed.length} failed
              </button>
            )}
          </button>
          {showFailed && (
            <div className="px-2 pb-3 max-h-64 overflow-y-auto space-y-1">
              {failureGroups.map((group) => (
                <FailureCategoryGroup
                  key={group.category}
                  group={group}
                  onRetryGroup={onRetryGroup}
                  onRetryJob={onRetryJob}
                  onClickJob={onClickJob}
                  retryingJobIds={retryingJobIds}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Smoke test checklist */}
      {summary.smokeTestChecklist ? (
        <div className="border-t border-surface-border/50 px-4 py-3">
          <div className="text-xs font-mono text-text-muted uppercase tracking-wider mb-2">
            AI Smoke Test Checklist
          </div>
          <div className="text-sm text-text whitespace-pre-wrap leading-relaxed">
            {summary.smokeTestChecklist}
          </div>
        </div>
      ) : (
        <div className="border-t border-surface-border/50 px-4 py-2 flex items-center gap-2 text-xs text-text-muted">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Generating smoke test checklist...
        </div>
      )}
    </div>
  );
}

export default function CampaignPage() {
  const { user, logout } = useAuth();
  const { data: projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [selectedBeadIds, setSelectedBeadIds] = useState<Set<string>>(new Set());
  const [reviewCollapsed, setReviewCollapsed] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>({ kind: 'feed' });
  const [summaryDismissed, setSummaryDismissed] = useState(false);

  // Auto-select first project
  const projectId = selectedProjectId || projects?.[0]?.id || '';

  const { data: beads, isLoading: beadsLoading } = useBeads(projectId);
  const readyBeads = useReadyBeads(projectId);
  const { data: jobs } = useJobs(projectId);
  const { data: stats } = useJobStats();
  const createJob = useCreateJob();
  const retryJob = useRetryJob();
  const [retryingJobIds, setRetryingJobIds] = useState<Set<string>>(new Set());
  const [retryAllPending, setRetryAllPending] = useState(false);

  async function handleRetryJob(jobId: string) {
    setRetryingJobIds((prev) => new Set(prev).add(jobId));
    try {
      await retryJob.mutateAsync(jobId);
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setRetryingJobIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  }

  async function handleRetryGroup(jobIds: string[]) {
    for (const jobId of jobIds) {
      await handleRetryJob(jobId);
    }
  }

  async function handleRetryAllFailed() {
    if (!drainSummary) return;
    const failedJobIds = drainSummary.jobs
      .filter((j) => j.status === 'failed')
      .map((j) => j.jobId);
    setRetryAllPending(true);
    try {
      await handleRetryGroup(failedJobIds);
    } finally {
      setRetryAllPending(false);
    }
  }

  // Server-side drain
  const { data: drainStatus } = useDrainStatus(projectId);
  const { data: preview } = useDrainPreview(projectId);
  const startDrain = useStartDrain();
  const stopDrain = useStopDrain();

  const isDraining = drainStatus?.active ?? false;

  // Fetch summary when drain is not active (and not dismissed)
  const { data: drainSummary } = useDrainSummary(projectId, !isDraining && !summaryDismissed);

  const tree = useMemo(() => buildBeadTree(beads || []), [beads]);
  const readyIds = useMemo(() => new Set(readyBeads.map((b) => b.id)), [readyBeads]);

  // Map bead_id to bead for the feed
  const beadMap = useMemo(() => new Map((beads || []).map((b) => [b.id, b])), [beads]);

  // Map bead_id to most recent job (for bead tree status badges)
  const jobMap = useMemo(() => {
    const m = new Map<string, Job>();
    if (!jobs) return m;
    for (const job of jobs) {
      if (job.bead_id && !m.has(job.bead_id)) {
        m.set(job.bead_id, job);
      }
    }
    return m;
  }, [jobs]);

  function toggleSelect(id: string) {
    setSelectedBeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function autoPickBeads() {
    if (preview?.candidates) {
      setSelectedBeadIds(new Set(preview.candidates.map((c) => c.id)));
      setReviewCollapsed(false);
    }
  }

  function selectAllReady() {
    setSelectedBeadIds(new Set(readyBeads.map((b) => b.id)));
  }

  function clearSelection() {
    setSelectedBeadIds(new Set());
  }

  async function handleDrain() {
    if (isDraining) {
      stopDrain.mutate(projectId);
      return;
    }

    if (selectedBeadIds.size > 0) {
      startDrain.mutate({
        projectId,
        beadIds: Array.from(selectedBeadIds),
      });
    } else {
      startDrain.mutate({
        projectId,
        autoSelect: true,
        maxAutoSelect: 10,
      });
    }
    setSelectedBeadIds(new Set());
    setSummaryDismissed(false);
  }

  async function handleDispatch(bead: Bead) {
    setDispatchingId(bead.id);
    try {
      const prompt = bead.preInstructions || bead.description || bead.subject;
      await createJob.mutateAsync({
        projectId,
        beadId: bead.id,
        prompt,
        priority: bead.priority,
      });
    } catch (err) {
      console.error('Dispatch failed:', err);
    } finally {
      setDispatchingId(null);
    }
  }

  const rootBeads = tree.children.get(undefined) || [];
  const selectedProject = projects?.find((p) => p.id === projectId);

  // Resolve right panel data
  const inspectedJob = rightPanel.kind === 'jobDetail'
    ? jobs?.find((j) => j.id === rightPanel.jobId) || null
    : null;
  const inspectedBead = rightPanel.kind === 'beadDetail'
    ? beads?.find((b) => b.id === rightPanel.beadId) || null
    : null;

  return (
    <div className="h-screen flex flex-col bg-surface text-text">
      {/* Header */}
      <header className="border-b border-surface-border px-4 py-3 flex items-center gap-4">
        <h1 className="text-lg font-bold tracking-tight">
          DD <span className="text-accent">Red</span>
        </h1>

        {/* Project selector */}
        <div className="relative">
          <select
            value={projectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setSelectedBeadIds(new Set());
              setRightPanel({ kind: 'feed' });
            }}
            className="appearance-none bg-surface-raised border border-surface-border rounded px-3 py-1.5 pr-8 text-sm text-text focus:outline-none focus:border-accent/50"
          >
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs font-mono text-text-muted ml-auto">
          <span className="text-green-400">{readyBeads.length} ready</span>
          <span className="text-yellow-400">{stats?.running ?? 0} running</span>
          <span className="text-blue-400">{stats?.queued ?? 0} queued</span>
          <span>{stats?.completed ?? 0} done</span>
          <span className="text-red-400">{stats?.failed ?? 0} failed</span>
        </div>

        {/* Drain controls */}
        <div className="flex items-center gap-2">
          {!isDraining && (
            <>
              <button
                onClick={autoPickBeads}
                className="px-2 py-1.5 text-xs rounded bg-surface-raised border border-surface-border text-text-muted hover:text-text transition-colors flex items-center gap-1"
                title={`Auto-pick ${preview?.count ?? '...'} ready leaf tasks`}
              >
                <Sparkles className="w-3 h-3" />
                Auto-pick{preview?.count ? ` (${preview.count})` : ''}
              </button>
              {readyBeads.length > 0 && (
                <button
                  onClick={selectedBeadIds.size > 0 ? clearSelection : selectAllReady}
                  className="px-2 py-1.5 text-xs rounded bg-surface-raised border border-surface-border text-text-muted hover:text-text transition-colors"
                >
                  {selectedBeadIds.size > 0 ? 'Clear' : 'All'}
                </button>
              )}
            </>
          )}

          <button
            onClick={handleDrain}
            disabled={startDrain.isPending || stopDrain.isPending}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              isDraining
                ? 'bg-accent text-white'
                : selectedBeadIds.size > 0
                  ? 'bg-accent/80 text-white hover:bg-accent'
                  : 'bg-surface-raised border border-surface-border text-text-muted hover:text-text'
            }`}
          >
            {isDraining ? (
              <>
                <Square className="w-4 h-4" />
                Stop ({drainStatus?.jobsCreated ?? 0} jobs)
              </>
            ) : selectedBeadIds.size > 0 ? (
              <>
                <Zap className="w-4 h-4" />
                Drain {selectedBeadIds.size} selected
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Drain
              </>
            )}
          </button>
        </div>

        {/* User */}
        {user && (
          <div className="flex items-center gap-2">
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-6 h-6 rounded-full"
              />
            )}
            <button
              onClick={logout}
              className="text-text-muted hover:text-text transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {/* Drain status banner */}
      {isDraining && (
        <div className="bg-accent/10 border-b border-accent/20 px-4 py-2 flex items-center gap-3 text-sm">
          <Zap className="w-4 h-4 text-accent animate-pulse" />
          <span className="text-accent font-medium">Server drain active</span>
          <span className="text-text-muted">
            {drainStatus?.jobsCreated ?? 0} jobs created
            {drainStatus?.readyCount ? ` · ${drainStatus.readyCount} ready` : ''}
            {drainStatus?.scopeSize ? ` · ${drainStatus.scopeSize} in scope` : ''}
          </span>
          <span className="text-text-muted text-xs ml-auto">
            Close this tab — the server keeps going
          </span>
        </div>
      )}

      {/* Drain summary panel */}
      {!isDraining && !summaryDismissed && drainSummary && (
        <DrainSummaryPanel
          summary={drainSummary}
          onDismiss={() => setSummaryDismissed(true)}
          onRetryJob={handleRetryJob}
          onRetryGroup={handleRetryGroup}
          onRetryAllFailed={handleRetryAllFailed}
          onClickJob={(jobId) => setRightPanel({ kind: 'jobDetail', jobId })}
          retryingJobIds={retryingJobIds}
          retryAllPending={retryAllPending}
        />
      )}

      {/* Selection review panel */}
      {!isDraining && selectedBeadIds.size > 0 && (
        <SelectionReview
          selectedIds={selectedBeadIds}
          beads={beads || []}
          onRemove={(id) => toggleSelect(id)}
          onClear={clearSelection}
          onInspect={(bead) => setRightPanel({ kind: 'beadDetail', beadId: bead.id })}
          collapsed={reviewCollapsed}
          onToggleCollapse={() => setReviewCollapsed(!reviewCollapsed)}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Bead tree - left panel */}
        <div className="flex-1 overflow-y-auto border-r border-surface-border">
          <div className="px-3 py-2 border-b border-surface-border flex items-center justify-between">
            <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
              Beads — {selectedProject?.name || '...'}
            </span>
            <span className="text-xs font-mono text-text-muted">
              {beads?.length ?? 0} total, {readyBeads.length} ready
              {selectedBeadIds.size > 0 && `, ${selectedBeadIds.size} selected`}
            </span>
          </div>
          {beadsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 text-text-muted animate-spin" />
            </div>
          ) : rootBeads.length === 0 ? (
            <div className="text-text-muted text-sm text-center py-12">
              No beads found. Import or create beads in dev-dash.
            </div>
          ) : (
            <div className="py-1">
              {rootBeads.map((bead) => (
                <BeadRow
                  key={bead.id}
                  bead={bead}
                  depth={0}
                  children={tree.children}
                  jobMap={jobMap}
                  readyIds={readyIds}
                  selectedIds={selectedBeadIds}
                  onToggleSelect={toggleSelect}
                  onDispatch={handleDispatch}
                  onInspect={(b) => setRightPanel({ kind: 'beadDetail', beadId: b.id })}
                  dispatchingId={dispatchingId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right panel: state machine */}
        <div className="w-96 overflow-hidden flex flex-col">
          {rightPanel.kind === 'beadDetail' && inspectedBead ? (
            <BeadDetailPanel
              bead={inspectedBead}
              allBeads={beads || []}
              jobs={jobs || []}
              onBack={() => setRightPanel({ kind: 'feed' })}
            />
          ) : rightPanel.kind === 'jobDetail' && inspectedJob ? (
            <JobDetailPanel
              job={inspectedJob}
              bead={inspectedJob.bead_id ? beadMap.get(inspectedJob.bead_id) : null}
              onBack={() => setRightPanel({ kind: 'feed' })}
              onClickBead={(beadId) => setRightPanel({ kind: 'beadDetail', beadId })}
              onRetry={handleRetryJob}
              isRetrying={retryingJobIds.has(inspectedJob.id)}
            />
          ) : rightPanel.kind === 'drainDetail' ? (
            <DrainDetailPanel
              projectId={projectId}
              drainId={rightPanel.drainId}
              onBack={() => setRightPanel({ kind: 'feed' })}
              onClickJob={(jobId) => setRightPanel({ kind: 'jobDetail', jobId })}
            />
          ) : (
            <>
              <div className="px-3 py-2 border-b border-surface-border">
                <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
                  Job Feed
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <JobFeed
                  jobs={jobs || []}
                  beadMap={beadMap}
                  onClickJob={(jobId) => setRightPanel({ kind: 'jobDetail', jobId })}
                  onClickDrainGroup={(drainId) => setRightPanel({ kind: 'drainDetail', drainId })}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
