import { Button } from '@astryxdesign/core/Button';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import type { PatchDraft } from '../../../src/contracts';
import { buildUnifiedDiff } from '../lib/diff';

const MultiFileDiff = lazy(async () => {
  const diffModule = await import('@pierre/diffs/react');
  return { default: diffModule.MultiFileDiff };
});

export function FileDiff({ patch }: { patch: PatchDraft }) {
  const [isWide, setIsWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  const [useSplit, setUseSplit] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsWide(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const oldFile = useMemo(
    () => ({
      name: patch.path,
      contents: patch.before,
      cacheKey: `before:${patch.id}:${patch.before.length}`,
    }),
    [patch.before, patch.id, patch.path],
  );
  const newFile = useMemo(
    () => ({
      name: patch.path,
      contents: patch.after,
      cacheKey: `after:${patch.digest}`,
    }),
    [patch.after, patch.digest, patch.path],
  );
  const options = useMemo(
    () =>
      ({
        diffStyle: isWide && useSplit ? 'split' : 'unified',
        overflow: 'wrap',
        expandUnchanged: true,
        diffIndicators: 'classic',
      }) as const,
    [isWide, useSplit],
  );
  const unified = useMemo(
    () => buildUnifiedDiff(patch.before, patch.after, patch.path),
    [patch.after, patch.before, patch.path],
  );
  const toggleView = useCallback(() => setUseSplit((current) => !current), []);
  const fallback = useMemo(() => <Text type="supporting">Loading file diff…</Text>, []);

  return (
    <VStack gap={2} width="100%">
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Text type="supporting" color="secondary">
          Original and proposed source. Wrapped unified view shows full context.
        </Text>
        {isWide ? (
          <Button
            label={useSplit ? 'Use unified view' : 'Use split view'}
            variant="ghost"
            size="sm"
            clickAction={toggleView}
          />
        ) : null}
      </HStack>
      <Suspense fallback={fallback}>
        <MultiFileDiff oldFile={oldFile} newFile={newFile} options={options} />
      </Suspense>
      <Text type="supporting" color="secondary">
        Plain unified patch. This text remains readable without the rich viewer.
      </Text>
      {unified ? (
        <CodeBlock
          code={unified}
          language="markdown"
          isDiff
          title={`${patch.path} (unified text)`}
          hasLanguageLabel={false}
          hasCopyButton={false}
          isWrapped
          size="sm"
          width="100%"
          container="section"
        />
      ) : (
        <Text type="supporting" color="secondary">
          No textual changes
        </Text>
      )}
    </VStack>
  );
}
