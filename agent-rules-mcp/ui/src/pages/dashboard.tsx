import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Divider } from '@astryxdesign/core/Divider';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack, Layout, LayoutContent, VStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';

import type { Decision, PatchDraft } from '../../../src/contracts';
import { PatchGroup } from '../components/patch-group';
import { usePatches } from '../lib/use-patches';

const emptyPatches: PatchDraft[] = [];

export default function DashboardPage() {
  const token = new URLSearchParams(window.location.search).get('token')?.trim() || null;
  const { query, mutation } = usePatches(token);
  const patches = query.data?.patches ?? emptyPatches;
  const closed = query.data?.closed === true;
  const loadError = query.error?.message;
  const actionError = mutation.error?.message;
  const pending = patches
    .filter((patch) => patch.status === 'pending')
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const decided = patches
    .filter((patch) => patch.status === 'approved' || patch.status === 'denied')
    .sort((left, right) => (right.decidedAt ?? '').localeCompare(left.decidedAt ?? ''));
  const unknown = patches
    .filter((patch) => patch.status === 'unknown')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const refresh = () => {
    if (!closed && !mutation.isPending) void query.refetch();
  };
  const decide = (patch: PatchDraft, decision: Decision) => {
    if (!mutation.isPending) mutation.mutate({ patchId: patch.id, decision });
  };
  const groupActions = {
    isBusy: mutation.isPending,
    busyId: mutation.isPending ? mutation.variables.patchId : undefined,
    onDecide: decide,
  };

  return (
    <Layout
      height="fill"
      content={
        <LayoutContent padding={6}>
          <VStack gap={6}>
            <HStack hAlign="between" vAlign="center" gap={4} wrap="wrap">
              <VStack gap={1}>
                <Heading level={1}>Rule patch approvals</Heading>
                <Text type="supporting" color="secondary">
                  Review proposed rule changes before the Worker applies them.
                </Text>
              </VStack>
              {token ? (
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
                    isLoading={query.isFetching}
                    isDisabled={closed || mutation.isPending}
                    clickAction={refresh}
                  />
                </HStack>
              ) : null}
            </HStack>
            {!token ? (
              <Banner
                status="error"
                title="Missing dashboard token"
                description="Open the link returned with the rule patch proposal."
              />
            ) : null}
            {closed ? (
              <Banner
                status="success"
                title="All decisions recorded"
                description="This dashboard link is now closed. Keep the approval IDs shown below to apply approved patches."
              />
            ) : null}
            {loadError ? (
              <Banner
                status="error"
                title="Could not load patches"
                description={loadError}
                endContent={
                  <Button label="Retry" variant="secondary" size="sm" clickAction={refresh} />
                }
              />
            ) : null}
            {actionError ? (
              <Banner
                status="error"
                title="Decision failed"
                description={actionError}
                isDismissable
                onDismiss={() => mutation.reset()}
                dismissLabel="Dismiss"
              />
            ) : null}
            {token && !query.isFetching && !loadError && patches.length === 0 ? (
              <EmptyState
                title="No rule patches"
                description="There are no patches to review for this token."
                headingLevel={2}
                actions={
                  <Button label="Refresh" variant="secondary" size="sm" clickAction={refresh} />
                }
              />
            ) : null}
            {token && patches.length > 0 ? (
              <VStack gap={6}>
                <PatchGroup
                  title="Undecided"
                  description="Proposed patches waiting for a decision."
                  emptyLabel="Nothing waiting for a decision."
                  patches={pending}
                  showActions
                  badgeVariant="warning"
                  {...groupActions}
                />
                <Divider />
                <PatchGroup
                  title="Recently decided"
                  description="Approved and denied patches, newest first."
                  emptyLabel="No decisions have been recorded yet."
                  patches={decided}
                  showActions={false}
                  badgeVariant="success"
                  {...groupActions}
                />
                <Divider />
                <PatchGroup
                  title="Unknown"
                  description="Patches whose outcome could not be confirmed."
                  emptyLabel="No patches in an unknown state."
                  patches={unknown}
                  showActions={false}
                  badgeVariant="neutral"
                  {...groupActions}
                />
              </VStack>
            ) : null}
          </VStack>
        </LayoutContent>
      }
    />
  );
}
