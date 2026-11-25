// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { VStack, HStack, Layout, LayoutContent } from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { Divider } from '@astryxdesign/core/Divider';
import { Link } from '@astryxdesign/core/Link';
import { Table, proportional } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { VisuallyHidden } from '@astryxdesign/core/VisuallyHidden';

// ============= DATA CONTRACT =============

type PatchStatus = 'pending' | 'approved' | 'denied' | 'unknown';
type Decision = 'approved' | 'denied';

interface Patch extends Record<string, unknown> {
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
}

const STATUS_VARIANTS = {
  pending: 'warning',
  approved: 'success',
  denied: 'error',
  unknown: 'neutral',
} as const;

const STATUSES: PatchStatus[] = ['pending', 'approved', 'denied', 'unknown'];

function isStatus(value: unknown): value is PatchStatus {
  return typeof value === 'string' && STATUSES.includes(value as PatchStatus);
}

function toPatch(value: unknown): Patch | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as Partial<Patch>;
  if (typeof candidate.id !== 'string' || typeof candidate.path !== 'string') {
    return null;
  }
  return {
    id: candidate.id,
    path: candidate.path,
    before: typeof candidate.before === 'string' ? candidate.before : '',
    after: typeof candidate.after === 'string' ? candidate.after : '',
    summary: typeof candidate.summary === 'string' ? candidate.summary : '',
    digest: typeof candidate.digest === 'string' ? candidate.digest : '',
    status: isStatus(candidate.status) ? candidate.status : 'unknown',
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : '',
    decidedAt: typeof candidate.decidedAt === 'string' ? candidate.decidedAt : undefined,
    approvalId: typeof candidate.approvalId === 'string' ? candidate.approvalId : undefined,
    pullRequestUrl:
      typeof candidate.pullRequestUrl === 'string' ? candidate.pullRequestUrl : undefined,
  };
}

function readToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return new URLSearchParams(window.location.search).get('token')?.trim() || null;
}

function formatTime(value?: string): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatInTimeZone(date, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');
}

function shortDigest(digest: string): string {
  return digest ? digest.slice(0, 8) : '—';
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

// ============= UNIFIED DIFF =============

interface DiffOp {
  kind: ' ' | '+' | '-';
  text: string;
  oldLine: number;
  newLine: number;
}

function splitLines(text: string): string[] {
  if (!text) {
    return [];
  }
  const normalized = text.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  if (lines[lines.length - 1] === '' && normalized.endsWith('\n')) {
    lines.pop();
  }
  return lines;
}

function diffOps(before: string, after: string): DiffOp[] {
  const a = splitLines(before);
  const b = splitLines(after);
  const n = a.length;
  const m = b.length;

  // Fall back to a whole-file replacement for pathologically large inputs.
  if (n * m > 400000) {
    return [
      ...a.map((text, index) => ({
        kind: '-' as const,
        text,
        oldLine: index + 1,
        newLine: 0,
      })),
      ...b.map((text, index) => ({
        kind: '+' as const,
        text,
        oldLine: 0,
        newLine: index + 1,
      })),
    ];
  }

  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  let oldLine = 1;
  let newLine = 1;

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: ' ', text: a[i], oldLine: oldLine++, newLine: newLine++ });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ kind: '-', text: a[i], oldLine: oldLine++, newLine });
      i++;
    } else {
      ops.push({ kind: '+', text: b[j], oldLine, newLine: newLine++ });
      j++;
    }
  }
  while (i < n) {
    ops.push({ kind: '-', text: a[i], oldLine: oldLine++, newLine });
    i++;
  }
  while (j < m) {
    ops.push({ kind: '+', text: b[j], oldLine, newLine: newLine++ });
    j++;
  }
  return ops;
}

function range(start: number, count: number): string {
  return count === 1 ? `${start}` : `${start},${count}`;
}

function buildUnifiedDiff(before: string, after: string, path: string): string {
  const ops = diffOps(before, after);
  if (!ops.some((op) => op.kind !== ' ')) {
    return '';
  }

  const context = 3;
  const hunks: Array<[number, number]> = [];
  ops.forEach((op, index) => {
    if (op.kind === ' ') {
      return;
    }
    const start = Math.max(0, index - context);
    const end = Math.min(ops.length, index + context + 1);
    const previous = hunks[hunks.length - 1];
    if (previous && start <= previous[1]) {
      previous[1] = Math.max(previous[1], end);
    } else {
      hunks.push([start, end]);
    }
  });

  const header = `--- a/${path}\n+++ b/${path}`;
  const bodies = hunks.map(([start, end]) => {
    const slice = ops.slice(start, end);
    const oldLines = slice.filter((op) => op.kind !== '+').map((op) => op.oldLine);
    const newLines = slice.filter((op) => op.kind !== '-').map((op) => op.newLine);
    const oldStart = oldLines.length ? oldLines[0] : Math.max(0, (slice[0]?.oldLine ?? 1) - 1);
    const newStart = newLines.length ? newLines[0] : Math.max(0, (slice[0]?.newLine ?? 1) - 1);
    return [
      `@@ -${range(oldStart, oldLines.length)} +${range(newStart, newLines.length)} @@`,
      ...slice.map((op) => `${op.kind}${op.text}`),
    ].join('\n');
  });
  return [header, ...bodies].join('\n');
}

// ============= GROUPS =============

interface PatchGroupProps {
  title: string;
  description: string;
  emptyLabel: string;
  patches: Patch[];
  showActions: boolean;
  badgeVariant: (typeof STATUS_VARIANTS)[PatchStatus];
  busyIds: Set<string>;
  onDecide: (patch: Patch, decision: Decision) => void;
}

function PatchGroup({
  title,
  description,
  emptyLabel,
  patches,
  showActions,
  badgeVariant,
  busyIds,
  onDecide,
}: PatchGroupProps) {
  const columns: TableColumn<Patch>[] = [
    {
      key: 'summary',
      header: 'Patch',
      width: proportional(4),
      renderCell: (patch: Patch) => (
        <VStack gap={1}>
          <Text type="label" weight="semibold" wordBreak="break-all">
            {patch.path}
          </Text>
          <Text type="body">{patch.summary || 'No summary provided'}</Text>
          <HStack gap={3} wrap="wrap">
            <Text type="supporting" color="secondary">
              Digest {shortDigest(patch.digest)}
            </Text>
            <Text type="supporting" color="secondary">
              Proposed {formatTime(patch.createdAt)}
            </Text>
            {patch.decidedAt ? (
              <Text type="supporting" color="secondary">
                Decided {formatTime(patch.decidedAt)}
              </Text>
            ) : null}
            {patch.approvalId ? (
              <Text type="supporting" color="secondary">
                Approval {patch.approvalId}
              </Text>
            ) : null}
          </HStack>
          {patch.pullRequestUrl ? (
            <Link href={patch.pullRequestUrl} isExternalLink>
              View pull request
            </Link>
          ) : null}
        </VStack>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: proportional(1),
      renderCell: (patch: Patch) => (
        <Badge label={patch.status} variant={STATUS_VARIANTS[patch.status]} />
      ),
    },
    {
      key: 'diff',
      header: 'Unified diff',
      width: proportional(6),
      renderCell: (patch: Patch) => {
        const diff = buildUnifiedDiff(patch.before, patch.after, patch.path);
        return diff ? (
          <CodeBlock
            code={diff}
            language="markdown"
            isDiff
            title={patch.path}
            hasLanguageLabel={false}
            hasCopyButton={false}
            isWrapped
            isCollapsible
            collapsibleThreshold={10}
            size="sm"
            width="100%"
            container="section"
          />
        ) : (
          <Text type="supporting" color="secondary">
            No textual changes
          </Text>
        );
      },
    },
    {
      key: 'actions',
      header: 'Decision',
      width: proportional(2),
      renderCell: (patch: Patch) =>
        showActions ? (
          <HStack gap={2} wrap="wrap">
            <Button
              label="Allow"
              variant="primary"
              size="sm"
              isLoading={busyIds.has(patch.id)}
              clickAction={() => onDecide(patch, 'approved')}
            />
            <Button
              label="Deny"
              variant="destructive"
              size="sm"
              isLoading={busyIds.has(patch.id)}
              clickAction={() => onDecide(patch, 'denied')}
            />
          </HStack>
        ) : (
          <Text type="supporting" color="secondary">
            —
          </Text>
        ),
    },
  ];

  return (
    <VStack gap={3}>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Heading level={3} accessibilityLevel={3}>
          {title}
        </Heading>
        <Badge label={String(patches.length)} variant={badgeVariant} />
        <Text type="supporting" color="secondary">
          {description}
        </Text>
      </HStack>
      {patches.length ? (
        <Table<Patch>
          data={patches}
          columns={columns}
          idKey="id"
          density="compact"
          dividers="rows"
          hasHover
          verticalAlign="top"
        />
      ) : (
        <Text type="supporting" color="secondary">
          {emptyLabel}
        </Text>
      )}
    </VStack>
  );
}

// ============= PAGE =============

export default function DashboardTemplate() {
  const token = readToken();
  const [patches, setPatches] = useState<Patch[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/patches?token=${encodeURIComponent(token)}`, {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const body: unknown = await response.json();
      if (
        !body ||
        typeof body !== 'object' ||
        !Array.isArray((body as { patches?: unknown }).patches)
      ) {
        throw new Error('Unexpected response from the server');
      }
      const received = (body as { patches: unknown[] }).patches
        .map(toPatch)
        .filter((patch): patch is Patch => patch !== null);
      setPatches(received);
    } catch (cause) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(
    async (patch: Patch, decision: Decision) => {
      if (!token || busyIds.has(patch.id)) {
        return;
      }
      setBusyIds((previous) => new Set(previous).add(patch.id));
      setActionError(null);
      try {
        const response = await fetch('/api/decide', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token, patchId: patch.id, decision }),
        });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const result: unknown = await response.json();
        if (!result || (result as { ok?: boolean }).ok !== true) {
          throw new Error('The server did not confirm the decision');
        }
        setPatches((previous) =>
          previous.map((item) =>
            item.id === patch.id
              ? {
                  ...item,
                  status: decision,
                  decidedAt: new Date().toISOString(),
                }
              : item,
          ),
        );
      } catch (cause) {
        setActionError(errorMessage(cause));
      } finally {
        setBusyIds((previous) => {
          const next = new Set(previous);
          next.delete(patch.id);
          return next;
        });
      }
    },
    [token, busyIds],
  );

  let content: ReactNode;

  if (!token) {
    content = (
      <VStack gap={4}>
        <Banner
          status="error"
          title="Missing dashboard token"
          description="Open the link returned with the rule patch proposal."
        />
        <EmptyState
          title="No token supplied"
          description="This page needs a ?token= value to load its patches."
          headingLevel={2}
        />
      </VStack>
    );
  } else {
    const pending = patches
      .filter((patch) => patch.status === 'pending')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const decided = patches
      .filter((patch) => patch.status === 'approved' || patch.status === 'denied')
      .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''));
    const unknown = patches
      .filter((patch) => patch.status === 'unknown')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    content = (
      <VStack gap={6}>
        <HStack hAlign="between" vAlign="center" gap={4} wrap="wrap">
          <VStack gap={1}>
            <Heading level={2} accessibilityLevel={2}>
              Rule patch approvals
            </Heading>
            <Text type="supporting" color="secondary">
              Review proposed rule changes before the Worker applies them.
            </Text>
          </VStack>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Badge label={`${pending.length} pending`} variant="warning" />
            <Badge
              label={`${decided.filter((patch) => patch.status === 'approved').length} approved`}
              variant="success"
            />
            <Badge
              label={`${decided.filter((patch) => patch.status === 'denied').length} denied`}
              variant="error"
            />
            <Badge label={`${unknown.length} unknown`} />
            <Button
              label="Refresh"
              variant="secondary"
              size="sm"
              isLoading={isLoading}
              clickAction={() => load()}
            />
          </HStack>
        </HStack>

        {loadError ? (
          <Banner
            status="error"
            title="Could not load patches"
            description={loadError}
            endContent={
              <Button label="Retry" variant="secondary" size="sm" clickAction={() => load()} />
            }
          />
        ) : null}

        {actionError ? (
          <Banner
            status="error"
            title="Decision failed"
            description={actionError}
            isDismissable
            onDismiss={() => setActionError(null)}
            dismissLabel="Dismiss"
          />
        ) : null}

        {!isLoading && !loadError && patches.length === 0 ? (
          <EmptyState
            title="No rule patches"
            description="There are no patches to review for this token."
            headingLevel={2}
            actions={
              <Button label="Refresh" variant="secondary" size="sm" clickAction={() => load()} />
            }
          />
        ) : (
          <VStack gap={6}>
            <PatchGroup
              title="Undecided"
              description="Proposed patches waiting for a decision."
              emptyLabel="Nothing waiting for a decision."
              patches={pending}
              showActions
              badgeVariant="warning"
              busyIds={busyIds}
              onDecide={decide}
            />
            <Divider />
            <PatchGroup
              title="Recently decided"
              description="Approved and denied patches, newest first."
              emptyLabel="No decisions have been recorded yet."
              patches={decided}
              showActions={false}
              badgeVariant="success"
              busyIds={busyIds}
              onDecide={decide}
            />
            <Divider />
            <PatchGroup
              title="Unknown"
              description="Patches whose decision could not be confirmed."
              emptyLabel="No patches in an unknown state."
              patches={unknown}
              showActions={false}
              badgeVariant="neutral"
              busyIds={busyIds}
              onDecide={decide}
            />
          </VStack>
        )}
      </VStack>
    );
  }

  return (
    <Layout
      height="fill"
      content={
        <LayoutContent role="main" padding={6}>
          <VisuallyHidden as="h1">Rule patch approvals</VisuallyHidden>
          {content}
        </LayoutContent>
      }
    />
  );
}
