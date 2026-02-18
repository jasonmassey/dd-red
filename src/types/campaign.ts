import type { Bead, Job } from '../lib/types';

export interface TaskNode extends Bead {
  children: TaskNode[];
  activeJob?: Job;
  isReady: boolean;
  depth: number;
}

export interface CampaignTree {
  roots: TaskNode[];
  allNodes: Map<string, TaskNode>;
  readyNodes: TaskNode[];
}

export interface DependencyEdge {
  fromId: string;
  toId: string;
  type: 'blocks' | 'blocked_by';
}
