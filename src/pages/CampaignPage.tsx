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
  ChevronDown,
  ChevronUp,
  LogOut,
  RefreshCw,
  Sparkles,
  Check,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../hooks/useProjects';
import { useBeads, useReadyBeads } from '../hooks/useBeads';
import { useJobs, useCreateJob, useJobStats } from '../hooks/useJobs';
import { useDrainStatus, useDrainPreview, useStartDrain, useStopDrain } from '../hooks/useDrain';
import { BeadDetailPanel } from '../components/BeadDetailPanel';
import type { Bead, Job, BeadStatus } from '../lib/types';

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

function JobFeed({ jobs }: { jobs: Job[] }) {
  const recent = jobs.slice(0, 20);

  if (recent.length === 0) {
    return (
      <div className="text-text-muted text-sm text-center py-8">
        No jobs yet. Dispatch a bead to start.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {recent.map((job) => (
        <div
          key={job.id}
          className="flex items-center gap-2 py-1.5 px-3 text-sm rounded hover:bg-surface-raised/50"
        >
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              job.status === 'running'
                ? 'bg-yellow-400 animate-pulse'
                : job.status === 'queued'
                  ? 'bg-blue-400'
                  : job.status === 'completed'
                    ? 'bg-green-400'
                    : job.status === 'failed'
                      ? 'bg-red-400'
                      : 'bg-text-muted'
            }`}
          />
          <span className="text-text truncate flex-1 font-mono text-xs">
            {job.id.slice(0, 8)}
          </span>
          <span className="text-text-muted text-xs truncate max-w-[200px]">
            {job.prompt.slice(0, 60)}
          </span>
          <span className="text-text-muted text-xs font-mono">
            {job.status}
          </span>
        </div>
      ))}
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

export default function CampaignPage() {
  const { user, logout } = useAuth();
  const { data: projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [selectedBeadIds, setSelectedBeadIds] = useState<Set<string>>(new Set());
  const [reviewCollapsed, setReviewCollapsed] = useState(false);
  const [inspectedBeadId, setInspectedBeadId] = useState<string | null>(null);

  // Auto-select first project
  const projectId = selectedProjectId || projects?.[0]?.id || '';

  const { data: beads, isLoading: beadsLoading } = useBeads(projectId);
  const readyBeads = useReadyBeads(projectId);
  const { data: jobs } = useJobs(projectId);
  const { data: stats } = useJobStats();
  const createJob = useCreateJob();

  // Server-side drain
  const { data: drainStatus } = useDrainStatus(projectId);
  const { data: preview } = useDrainPreview(projectId);
  const startDrain = useStartDrain();
  const stopDrain = useStopDrain();

  const isDraining = drainStatus?.active ?? false;

  const tree = useMemo(() => buildBeadTree(beads || []), [beads]);
  const readyIds = useMemo(() => new Set(readyBeads.map((b) => b.id)), [readyBeads]);

  // Map bead_id to most recent job
  const jobMap = useMemo(() => {
    const m = new Map<string, Job>();
    if (!jobs) return m;
    // Jobs are returned newest first, so first match per bead_id wins
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
      // Drain selected beads
      startDrain.mutate({
        projectId,
        beadIds: Array.from(selectedBeadIds),
      });
    } else {
      // Auto-select mode
      startDrain.mutate({
        projectId,
        autoSelect: true,
        maxAutoSelect: 10,
      });
    }
    setSelectedBeadIds(new Set());
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
  const inspectedBead = inspectedBeadId ? beads?.find((b) => b.id === inspectedBeadId) || null : null;

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

      {/* Selection review panel */}
      {!isDraining && selectedBeadIds.size > 0 && (
        <SelectionReview
          selectedIds={selectedBeadIds}
          beads={beads || []}
          onRemove={(id) => toggleSelect(id)}
          onClear={clearSelection}
          onInspect={(bead) => setInspectedBeadId(bead.id)}
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
                  onInspect={(b) => setInspectedBeadId(b.id)}
                  dispatchingId={dispatchingId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right panel: detail view or job feed */}
        <div className="w-96 overflow-hidden flex flex-col">
          {inspectedBead ? (
            <BeadDetailPanel
              bead={inspectedBead}
              allBeads={beads || []}
              jobs={jobs || []}
              onBack={() => setInspectedBeadId(null)}
            />
          ) : (
            <>
              <div className="px-3 py-2 border-b border-surface-border">
                <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
                  Job Feed
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <JobFeed jobs={jobs || []} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
