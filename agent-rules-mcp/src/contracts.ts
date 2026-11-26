import { z } from 'zod';

export const reviewerSchema = z.object({
  issuer: z.url(),
  sub: z.string().min(1),
  email: z.email(),
});
export type Reviewer = z.infer<typeof reviewerSchema>;

export const approvalSchema = z.object({
  id: z.string().min(1),
  patchId: z.string().min(1),
  digest: z.string().min(1),
  decision: z.enum(['approved', 'denied']),
  decidedAt: z.iso.datetime(),
  expiresAt: z.number(),
  used: z.boolean(),
  reviewer: reviewerSchema.optional(),
  legacy: z.boolean().optional(),
});

export const patchSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  before: z.string(),
  after: z.string(),
  summary: z.string().min(1),
  digest: z.string().min(1),
  status: z.enum([
    'pending',
    'approved',
    'denied',
    'unknown',
    'submitting',
    'submitted',
    'stale',
    'expired',
    'failed',
  ]),
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().optional(),
  approvalId: z.string().min(1).optional(),
  pullRequestUrl: z.url().optional(),
  history: z.array(approvalSchema).optional(),
  message: z.string().optional(),
  finalAt: z.number().optional(),
  legacy: z.boolean().optional(),
  expiresAt: z.number().optional(),
});

export const decisionSchema = z.object({
  patchId: z.string().min(1),
  decision: z.enum(['approved', 'denied']),
});

export const dashboardSchema = z.object({
  patches: z.array(patchSchema),
  closed: z.boolean(),
  accessExpiresAt: z.number().optional(),
});

export const decisionResultSchema = z.object({
  ok: z.literal(true),
  patch: patchSchema,
  closed: z.boolean(),
});

export type PatchDraft = z.infer<typeof patchSchema>;
export type PatchStatus = PatchDraft['status'];

export const submissionStatuses = ['approved', 'submitting', 'submitted'] as const;
export const attentionStatuses = ['unknown', 'stale', 'failed', 'expired'] as const;
export const replayableStatuses = [
  'submitting',
  'submitted',
  'unknown',
  'stale',
  'failed',
] as const;
export type Decision = z.infer<typeof decisionSchema>['decision'];
export type DashboardData = z.infer<typeof dashboardSchema>;
export type DecisionResult = z.infer<typeof decisionResultSchema>;

export type DashboardToken = {
  id: string;
  expiresAt: number;
  patchIds: string[];
};

export type ApprovalRecord = z.infer<typeof approvalSchema>;

export const submissionPhases = [
  'base',
  'source',
  'blob',
  'tree',
  'commit',
  'branch',
  'pull',
  'recover',
  'done',
  'blocked',
] as const;
export type SubmissionPhase = (typeof submissionPhases)[number];

export type Submission = {
  patchId: string;
  approvalId: string;
  phase: SubmissionPhase;
  dueAt: number;
  attempts: number;
  baseSha?: string;
  blobSha?: string;
  treeSha?: string;
  commitSha?: string;
  pullSent?: boolean;
  message?: string;
};
