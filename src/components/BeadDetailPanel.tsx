import {
  Circle,
  Clock,
  CheckCircle2,
  Lock,
  XCircle,
  FileText,
  Terminal,
  GitBranch,
  ArrowRight,
  CornerDownRight,
  User,
  Calendar,
  Copy,
  Check,
  ArrowLeft,
  Play,
  Ban,
} from 'lucide-react';
import { useState } from 'react';
import type { Bead, Job, BeadStatus, JobStatus } from '../lib/types';

const STATUS_CONFIG: Record<BeadStatus, { icon: typeof Circle; color: string; label: string; bg: string }> = {
  pending: { icon: Circle, color: 'text-text-muted', label: 'Pending', bg: 'bg-text-muted/10' },
  in_progress: { icon: Clock, color: 'text-yellow-400', label: 'In Progress', bg: 'bg-yellow-400/10' },
  completed: { icon: CheckCircle2, color: 'text-green-400', label: 'Completed', bg: 'bg-green-400/10' },
  blocked: { icon: Lock, color: 'text-orange-400', label: 'Blocked', bg: 'bg-orange-400/10' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed', bg: 'bg-red-400/10' },
};

const JOB_STATUS_CONFIG: Record<JobStatus, { icon: typeof Circle; color: string; label: string }> = {
  queued: { icon: Clock, color: 'text-blue-400', label: 'Queued' },
  running: { icon: Play, color: 'text-yellow-400', label: 'Running' },
  completed: { icon: CheckCircle2, color: 'text-green-400', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
  cancelled: { icon: Ban, color: 'text-text-muted', label: 'Cancelled' },
};

const PRIORITY_COLOR: Record<number, string> = {
  0: 'bg-red-500/20 text-red-400',
  1: 'bg-orange-500/20 text-orange-400',
  2: 'bg-yellow-500/20 text-yellow-400',
  3: 'bg-blue-500/20 text-blue-400',
  4: 'bg-text-muted/20 text-text-muted',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString();
}

function RelatedBeadRow({ bead }: { bead: Bead }) {
  const config = STATUS_CONFIG[bead.status];
  const Icon = config.icon;
  return (
    <div className="flex items-center gap-2 p-2 bg-surface-raised/50 rounded">
      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
      <span className="text-sm text-text truncate flex-1">{bead.subject}</span>
      <span className={`text-xs ${config.color}`}>{config.label}</span>
    </div>
  );
}

export function BeadDetailPanel({
  bead,
  allBeads,
  jobs,
  onBack,
}: {
  bead: Bead;
  allBeads: Bead[];
  jobs: Job[];
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const config = STATUS_CONFIG[bead.status];
  const StatusIcon = config.icon;

  // Resolve relationships
  const blockedByBeads = bead.blockedBy
    .map((id) => allBeads.find((b) => b.id === id))
    .filter(Boolean) as Bead[];

  const blocksBeads = bead.blocks
    .map((id) => allBeads.find((b) => b.id === id))
    .filter(Boolean) as Bead[];

  const childrenBeads = allBeads.filter((b) => b.parentBeadId === bead.id);
  const parentBead = bead.parentBeadId
    ? allBeads.find((b) => b.id === bead.parentBeadId) || null
    : null;

  const beadJobs = jobs
    .filter((j) => j.bead_id === bead.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleCopyId = () => {
    navigator.clipboard.writeText(bead.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
          Task Detail
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${config.bg}`}>
            <StatusIcon className={`w-3.5 h-3.5 ${config.color}`} />
            <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
          </div>
          <span
            className={`text-xs font-mono px-2 py-1 rounded ${
              PRIORITY_COLOR[bead.priority] || PRIORITY_COLOR[4]
            }`}
          >
            P{bead.priority}
          </span>
          {bead.beadType && (
            <span className="text-xs px-2 py-1 rounded bg-surface-raised text-text-muted">
              {bead.beadType}
            </span>
          )}
          <button
            onClick={handleCopyId}
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded bg-surface-raised text-text-muted hover:text-text transition-colors"
            title="Copy task ID"
          >
            <span className="text-xs font-mono">{bead.id.slice(0, 8)}</span>
            {copied ? (
              <Check className="w-3 h-3 text-green-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>

        {/* Subject */}
        <h3 className="text-base font-semibold text-text leading-tight">{bead.subject}</h3>

        {/* Description */}
        <div className="space-y-1.5">
          <h4 className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" />
            Description
          </h4>
          {bead.description ? (
            <div className="bg-surface-raised/50 rounded p-3">
              <p className="text-sm text-text whitespace-pre-wrap">{bead.description}</p>
            </div>
          ) : (
            <p className="text-text-muted text-sm italic">No description</p>
          )}
        </div>

        {/* Owner */}
        {bead.owner && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
              <User className="w-3.5 h-3.5" />
              Assigned To
            </h4>
            <p className="text-sm text-text">{bead.owner}</p>
          </div>
        )}

        {/* Parent */}
        {parentBead && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
              <CornerDownRight className="w-3.5 h-3.5 text-purple-400" />
              Parent Task
            </h4>
            <RelatedBeadRow bead={parentBead} />
          </div>
        )}

        {/* Blocked by */}
        {blockedByBeads.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5 text-orange-400" />
              Blocked By
            </h4>
            <div className="space-y-1">
              {blockedByBeads.map((b) => (
                <RelatedBeadRow key={b.id} bead={b} />
              ))}
            </div>
          </div>
        )}

        {/* Blocks */}
        {blocksBeads.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
              <ArrowRight className="w-3.5 h-3.5 text-green-400" />
              Blocks
            </h4>
            <div className="space-y-1">
              {blocksBeads.map((b) => (
                <RelatedBeadRow key={b.id} bead={b} />
              ))}
            </div>
          </div>
        )}

        {/* Subtasks */}
        {childrenBeads.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
              <GitBranch className="w-3.5 h-3.5 text-purple-400" />
              Subtasks
              <span className="text-xs font-normal normal-case">
                ({childrenBeads.filter((c) => c.status === 'completed').length}/
                {childrenBeads.length} done)
              </span>
            </h4>
            <div className="space-y-1">
              {childrenBeads.map((child) => {
                const childConfig = STATUS_CONFIG[child.status];
                const ChildIcon = childConfig.icon;
                return (
                  <div
                    key={child.id}
                    className="flex items-center gap-2 p-2 bg-surface-raised/50 rounded"
                  >
                    <ChildIcon className={`w-3.5 h-3.5 ${childConfig.color}`} />
                    <span
                      className={`text-sm truncate flex-1 ${
                        child.status === 'completed'
                          ? 'line-through text-text-muted'
                          : 'text-text'
                      }`}
                    >
                      {child.subject}
                    </span>
                    <span className={`text-xs ${childConfig.color}`}>
                      {childConfig.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pre-instructions */}
        {bead.preInstructions && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
              <Terminal className="w-3.5 h-3.5" />
              Pre-instructions
            </h4>
            <div className="bg-surface-raised border border-surface-border rounded p-3">
              <pre className="text-sm text-text font-mono whitespace-pre-wrap overflow-x-auto">
                {bead.preInstructions}
              </pre>
            </div>
          </div>
        )}

        {/* Jobs */}
        {beadJobs.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
              <GitBranch className="w-3.5 h-3.5" />
              Jobs
              <span className="text-xs font-normal normal-case">({beadJobs.length})</span>
            </h4>
            <div className="space-y-1">
              {beadJobs.map((job) => {
                const jobConfig = JOB_STATUS_CONFIG[job.status];
                const JobIcon = jobConfig.icon;
                return (
                  <div
                    key={job.id}
                    className="flex items-center gap-2 p-2 bg-surface-raised/50 rounded"
                  >
                    <JobIcon className={`w-3.5 h-3.5 flex-shrink-0 ${jobConfig.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text truncate">
                        {job.prompt.length > 50
                          ? `${job.prompt.slice(0, 50)}...`
                          : job.prompt}
                      </p>
                      <p className="text-xs text-text-muted">{formatDate(job.created_at)}</p>
                    </div>
                    <span className={`text-xs ${jobConfig.color}`}>{jobConfig.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="pt-3 border-t border-surface-border space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-text-muted">Created:</span>
            <span className="text-text">{formatDate(bead.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-text-muted">Updated:</span>
            <span className="text-text">{formatDate(bead.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
