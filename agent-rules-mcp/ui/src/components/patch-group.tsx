import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Link } from '@astryxdesign/core/Link';
import { Table, proportional } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { Heading, Text } from '@astryxdesign/core/Text';
import { useCallback, useMemo } from 'react';

import type { Decision, PatchDraft } from '../../../src/contracts';
import { buildUnifiedDiff } from '../lib/diff';
import { formatTime } from '../lib/time';

interface PatchGroupProps {
  title: string;
  description: string;
  emptyLabel: string;
  patches: PatchDraft[];
  showActions: boolean;
  badgeVariant: 'warning' | 'success' | 'neutral';
  busyId?: string;
  isBusy: boolean;
  onDecide: (patch: PatchDraft, decision: Decision) => void;
}

function PatchActions({
  patch,
  isBusy,
  isLoading,
  onDecide,
}: {
  patch: PatchDraft;
  isBusy: boolean;
  isLoading: boolean;
  onDecide: PatchGroupProps['onDecide'];
}) {
  const allow = useCallback(() => onDecide(patch, 'approved'), [onDecide, patch]);
  const deny = useCallback(() => onDecide(patch, 'denied'), [onDecide, patch]);
  return (
    <HStack gap={2} wrap="wrap">
      <Button
        label="Allow"
        variant="primary"
        size="sm"
        isLoading={isLoading}
        isDisabled={isBusy}
        clickAction={allow}
      />
      <Button
        label="Deny"
        variant="destructive"
        size="sm"
        isLoading={isLoading}
        isDisabled={isBusy}
        clickAction={deny}
      />
    </HStack>
  );
}

export function PatchGroup({
  title,
  description,
  emptyLabel,
  patches,
  showActions,
  badgeVariant,
  busyId,
  isBusy,
  onDecide,
}: PatchGroupProps) {
  const columns = useMemo<TableColumn<PatchDraft>[]>(
    () => [
      {
        key: 'summary',
        header: 'Patch',
        width: proportional(4),
        renderCell: (patch) => (
          <VStack gap={1}>
            <Text type="label" weight="semibold" wordBreak="break-all">
              {patch.path}
            </Text>
            <Text>{patch.summary}</Text>
            <HStack gap={3} wrap="wrap">
              <Text type="supporting" color="secondary">
                Digest {patch.digest.slice(0, 8)}
              </Text>
              <Text type="supporting" color="secondary">
                Proposed {formatTime(patch.createdAt)}
              </Text>
              {patch.decidedAt ? (
                <Text type="supporting" color="secondary">
                  Decided {formatTime(patch.decidedAt)}
                </Text>
              ) : null}
            </HStack>
            {patch.approvalId ? (
              <Text type="code" wordBreak="break-all">
                Approval {patch.approvalId}
              </Text>
            ) : null}
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
        renderCell: (patch) => <Text>{patch.status}</Text>,
      },
      {
        key: 'diff',
        header: 'Unified diff',
        width: proportional(6),
        renderCell: (patch) => {
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
        renderCell: (patch) =>
          showActions ? (
            <PatchActions
              patch={patch}
              isBusy={isBusy}
              isLoading={busyId === patch.id}
              onDecide={onDecide}
            />
          ) : (
            <Text type="supporting" color="secondary">
              —
            </Text>
          ),
      },
    ],
    [busyId, isBusy, onDecide, showActions],
  );
  return (
    <VStack gap={3}>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Heading level={2}>{title}</Heading>
        <Badge label={String(patches.length)} variant={badgeVariant} />
        <Text type="supporting" color="secondary">
          {description}
        </Text>
      </HStack>
      {patches.length ? (
        <Table<PatchDraft>
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
