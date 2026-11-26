import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Divider } from '@astryxdesign/core/Divider';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack, Layout, LayoutContent, VStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';

import type { Decision, PatchDraft } from '../../../src/contracts';
import { attentionStatuses, submissionStatuses } from '../../../src/contracts';
import { PatchGroup } from '../components/patch-group';
import { formatEpoch } from '../lib/time';
import { usePatches } from '../lib/use-patches';

const emptyPatches: PatchDraft[] = [];

export default function DashboardPage() {
  const { query, mutation, renewal } = usePatches();
  const patches = query.data?.patches ?? emptyPatches;
  const loadError = query.error?.message;
  const actionError = mutation.error?.message;
  const needsSignIn = typeof loadError === 'string' && loadError.includes('401');
  const pending = patches.filter((patch) => patch.status === 'pending');
  const submitting = patches.filter((patch) =>
    (submissionStatuses as readonly string[]).includes(patch.status),
  );
  const attention = patches.filter((patch) =>
    (attentionStatuses as readonly string[]).includes(patch.status),
  );
  const denied = patches.filter((patch) => patch.status === 'denied');
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
                  Review proposed rule changes before the Worker submits them.
                </Text>
              </VStack>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Badge label={`${pending.length} pending`} variant="warning" />
                <Badge label={`${submitting.length} submitted`} variant="success" />
                <Badge label={`${attention.length} need attention`} />
                <Button
                  label="Renew access"
                  variant="secondary"
                  size="sm"
                  isLoading={renewal.isPending}
                  clickAction={() => renewal.mutate()}
                />
              </HStack>
            </HStack>
            {query.data?.accessExpiresAt !== undefined ? (
              <Text type="supporting" color="secondary">
                Review access expires {formatEpoch(query.data.accessExpiresAt)}. Proposal review
                deadlines are shown with each patch.
              </Text>
            ) : null}
            {needsSignIn ? (
              <Banner
                status="error"
                title="Reviewer sign-in required"
                description="Sign in with an authorized Cloudflare Access identity to see proposals."
                endContent={
                  <Button label="Sign in" variant="primary" size="sm" href="/review/login" />
                }
              />
            ) : null}
            {loadError && !needsSignIn ? (
              <Banner
                status="error"
                title="Could not load reviews"
                description={loadError}
                endContent={
                  <Button
                    label="Retry"
                    variant="secondary"
                    size="sm"
                    isLoading={query.isFetching}
                    clickAction={() => void query.refetch()}
                  />
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
            {!loadError && !query.isFetching && patches.length === 0 ? (
              <EmptyState
                title="No rule patches"
                description="There are no proposals on the repository review board."
                headingLevel={2}
                actions={
                  <Button label="Refresh" size="sm" clickAction={() => void query.refetch()} />
                }
              />
            ) : null}
            {patches.length > 0 ? (
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
                  title="Submitted"
                  description="Approved patches and their draft pull requests."
                  emptyLabel="No submitted patches yet."
                  patches={submitting}
                  showActions
                  badgeVariant="success"
                  {...groupActions}
                />
                <Divider />
                <PatchGroup
                  title="Needs attention"
                  description="Uncertain, stale, failed or expired submissions."
                  emptyLabel="No patches need attention."
                  patches={attention}
                  showActions={false}
                  badgeVariant="neutral"
                  {...groupActions}
                />
                <Divider />
                <PatchGroup
                  title="Denied"
                  description="Patches a reviewer declined."
                  emptyLabel="No denied patches."
                  patches={denied}
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
