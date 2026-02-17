import { useState, useEffect, useRef, useCallback } from 'react';
import { useReadyBeads } from './useBeads';
import { useJobs, useCreateJob, useJobStats } from './useJobs';
import type { Bead } from '../lib/types';

interface AutoDispatchState {
  readyCount: number;
  runningCount: number;
  completedCount: number;
  failedCount: number;
  dispatching: boolean;
  lastDispatched: string | null;
}

export function useAutoDispatch(projectId: string, enabled: boolean) {
  const readyBeads = useReadyBeads(projectId);
  const { data: jobs } = useJobs(projectId);
  const { data: stats } = useJobStats();
  const createJob = useCreateJob();

  const [dispatching, setDispatching] = useState(false);
  const [lastDispatched, setLastDispatched] = useState<string | null>(null);
  const dispatchingRef = useRef<Set<string>>(new Set());
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Count jobs by status for this project
  const runningJobs = jobs?.filter(
    (j) => j.status === 'queued' || j.status === 'running'
  ) || [];

  const dispatchNext = useCallback(async () => {
    if (!enabledRef.current) return;
    if (dispatchingRef.current.size > 0) return;
    if (runningJobs.length >= 1) return; // concurrency limit: 1

    // Find highest-priority ready bead not already dispatching or with active job
    const activeBeadIds = new Set(runningJobs.map((j) => j.bead_id).filter(Boolean));
    const candidate = readyBeads
      .filter((b) => !dispatchingRef.current.has(b.id) && !activeBeadIds.has(b.id))
      .sort((a, b) => a.priority - b.priority)[0];

    if (!candidate) return;

    dispatchingRef.current.add(candidate.id);
    setDispatching(true);

    try {
      const prompt = candidate.preInstructions || candidate.description || candidate.subject;
      await createJob.mutateAsync({
        projectId,
        beadId: candidate.id,
        prompt,
        priority: candidate.priority,
      });
      setLastDispatched(candidate.id);
    } catch (err) {
      console.error('[AutoDispatch] Failed to dispatch:', candidate.id, err);
    } finally {
      dispatchingRef.current.delete(candidate.id);
      setDispatching(false);
    }
  }, [readyBeads, runningJobs, projectId, createJob]);

  // Poll loop
  useEffect(() => {
    if (!enabled || !projectId) return;

    const interval = setInterval(dispatchNext, 5000);
    // Also dispatch immediately on enable
    dispatchNext();

    return () => clearInterval(interval);
  }, [enabled, projectId, dispatchNext]);

  return {
    readyCount: readyBeads.length,
    runningCount: stats?.running ?? 0,
    completedCount: stats?.completed ?? 0,
    failedCount: stats?.failed ?? 0,
    dispatching,
    lastDispatched,
  } satisfies AutoDispatchState;
}
