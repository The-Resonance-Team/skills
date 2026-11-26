'use client';

import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { Divider } from '@astryxdesign/core/Divider';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';

type ConsentParams = {
  handle: string;
  name: string;
  redirectHost: string;
  clientDomain: string;
  scopes: string[];
  isLoopback: boolean;
};

function readParams(): ConsentParams {
  const search = new URLSearchParams(window.location.search);
  return {
    handle: search.get('handle') ?? '',
    name: search.get('name') ?? 'This app',
    redirectHost: search.get('redirect') ?? 'this device',
    clientDomain: search.get('domain') ?? '',
    scopes: (search.get('scopes') ?? 'rules:read').split(' ').filter(Boolean),
    isLoopback: search.get('loopback') === '1',
  };
}

export default function ConsentPage() {
  const params = readParams();
  return (
    <Center axis="both" minHeight="100vh" padding={6}>
      <Card maxWidth={480} padding={6} elevation="med">
        <VStack gap={5}>
          <VStack gap={2}>
            <Heading level={1}>Authorize {params.name}</Heading>
            <Text>
              This app will receive an access token at <strong>{params.redirectHost}</strong>.
            </Text>
            {params.clientDomain.length > 0 ? (
              <Text color="secondary">Published by {params.clientDomain}.</Text>
            ) : (
              <Text color="secondary">This app registered itself; its name is not verified.</Text>
            )}
            {params.isLoopback ? (
              <Text>Continue only if you just started signing in from this device.</Text>
            ) : null}
          </VStack>

          <Divider />

          <VStack gap={3}>
            <Text>Requested access</Text>
            <HStack gap={2}>
              {params.scopes.map((scope) => (
                <Text key={scope} type="code">
                  {scope}
                </Text>
              ))}
            </HStack>
          </VStack>

          <form method="post" action="/authorize">
            <input type="hidden" name="handle" value={params.handle} />
            {params.scopes.map((scope) => (
              <input key={scope} type="hidden" name="scope" value={scope} />
            ))}
            <HStack gap={3}>
              <Button
                label="Allow"
                type="submit"
                name="decision"
                value="approve"
                variant="primary"
              />
              <Button label="Deny" type="submit" name="decision" value="deny" variant="secondary" />
            </HStack>
          </form>
        </VStack>
      </Card>
    </Center>
  );
}
