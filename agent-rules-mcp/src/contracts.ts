import { z } from 'zod';

export const patchSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  before: z.string(),
  after: z.string(),
  summary: z.string().min(1),
  digest: z.string().min(1),
  status: z.enum(['pending', 'approved', 'denied', 'unknown']),
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().optional(),
  approvalId: z.string().min(1).optional(),
  pullRequestUrl: z.url().optional(),
});

export const decisionSchema = z.object({
  token: z.string().min(1),
  patchId: z.string().min(1),
  decision: z.enum(['approved', 'denied']),
});

export const dashboardSchema = z.object({
  patches: z.array(patchSchema),
  closed: z.boolean(),
});

export const decisionResultSchema = z.object({
  ok: z.literal(true),
  patch: patchSchema,
  closed: z.boolean(),
});

export type PatchDraft = z.infer<typeof patchSchema>;
export type PatchStatus = PatchDraft['status'];
export type Decision = z.infer<typeof decisionSchema>['decision'];
export type DashboardData = z.infer<typeof dashboardSchema>;
export type DecisionResult = z.infer<typeof decisionResultSchema>;

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
  expiresAt: number;
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
