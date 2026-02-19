// Minimal types ported from dev-dash

export type BeadStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type WorkerType = 'docker' | 'e2b' | 'railway';

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  email?: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  githubRepo?: string;
  role?: 'owner' | 'member' | 'viewer' | 'custom';
  createdAt: string;
  updatedAt: string;
}

export interface Bead {
  id: string;
  subject: string;
  description: string;
  status: BeadStatus;
  owner?: string;
  blockedBy: string[];
  blocks: string[];
  parentBeadId?: string;
  beadType?: string;
  preInstructions?: string | null;
  functionalArea?: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobResult {
  prUrl?: string;
  commitSha?: string;
  branchName?: string;
  summary?: string;
  testResults?: {
    ran: boolean;
    passed: boolean;
    summary: string;
  };
  totalTokens?: number;
  durationMs?: number;
}

export interface FailureAnalysis {
  category: string;
  title: string;
  summary: string;
  suggestions: string[];
}

export interface Job {
  id: string;
  project_id: string;
  bead_id?: string;
  drain_id?: string;
  prompt: string;
  status: JobStatus;
  worker_type: WorkerType;
  worker_id?: string;
  priority: number;
  started_at?: string;
  completed_at?: string;
  error?: string;
  output_log?: string;
  result?: JobResult;
  failureAnalysis?: FailureAnalysis;
  created_at: string;
  updated_at: string;
}

export interface JobStats {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  concurrency: {
    running: number;
    max: number;
    available: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface DrainStatus {
  active: boolean;
  projectId: string;
  scopeSize: number;
  jobsCreated: number;
  maxJobs: number;
  startedAt: string | null;
  readyCount: number;
}

export interface DrainPreview {
  candidates: { id: string; subject: string; priority: number }[];
  count: number;
}

export interface DrainStartResult {
  success: boolean;
  active: boolean;
  jobsCreated: string[];
  scopeSize: number;
  readyBeads: { id: string; subject: string; priority: number }[];
}

export interface DrainSummaryJob {
  jobId: string;
  beadId?: string;
  subject: string;
  status: 'completed' | 'failed';
  prUrl?: string;
  branchName?: string;
  summary?: string;
  testResults?: { ran: boolean; passed: boolean; summary: string };
  failureCategory?: string;
  failureTitle?: string;
  failureSummary?: string;
}

export interface DrainSummary {
  projectId: string;
  drainId?: string;
  startedAt: string;
  completedAt: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  jobs: DrainSummaryJob[];
  smokeTestChecklist: string | null;
  checklistState?: boolean[];
}

export interface PRStatus {
  jobId: string;
  prUrl: string;
  prNumber: number;
  state: 'open' | 'closed' | 'merged';
  mergeable: boolean | null;
  ciStatus: 'success' | 'failure' | 'pending' | 'none';
  reviewStatus: 'approved' | 'changes_requested' | 'pending' | 'none';
  title: string;
  mergedAt: string | null;
}

export interface Drain {
  id: string;
  project_id: string;
  status: 'running' | 'completed' | 'stopped';
  scope_size: number;
  max_jobs: number;
  started_at: string;
  completed_at?: string;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  smoke_test_checklist?: string;
}

export interface DrainDetail extends Drain {
  jobs: Job[];
}
