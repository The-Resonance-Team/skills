export type PatchStatus = 'pending' | 'approved' | 'denied' | 'unknown';

export type PatchDraft = {
  id: string;
  path: string;
  before: string;
  after: string;
  summary: string;
  digest: string;
  status: PatchStatus;
  createdAt: string;
  decidedAt?: string;
  approvalId?: string;
  pullRequestUrl?: string;
};

export type DashboardToken = {
  id: string;
  expiresAt: number;
  patchIds: string[];
};

export type ApprovalRecord = {
  id: string;
  patchId: string;
  digest: string;
  decision: 'approved' | 'denied';
  decidedAt: string;
  used: boolean;
};

export type PullRequestInput = {
  owner: string;
  repo: string;
  base: string;
  branch: string;
  path: string;
  content: string;
  message: string;
  title: string;
  body: string;
};

export type PullRequestResult = {
  number: number;
  htmlUrl: string;
  state: string;
  draft: boolean;
};
