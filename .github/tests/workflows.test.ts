import { describe, expect, test } from 'bun:test';

type Job = {
  'runs-on'?: string;
  'timeout-minutes'?: number;
  uses?: string;
  if?: string;
  with?: Record<string, string | boolean>;
  steps?: Array<{
    name?: string;
    run?: string;
    uses?: string;
    with?: Record<string, string | boolean>;
  }>;
};
type Workflow = {
  on: Record<string, unknown>;
  concurrency: Record<string, unknown>;
  jobs: Record<string, Job>;
};

async function readWorkflow(name: string): Promise<{ text: string; workflow: Workflow }> {
  const text = await Bun.file(`${import.meta.dir}/../workflows/${name}`).text();
  return { text, workflow: Bun.YAML.parse(text) as Workflow };
}

describe('MCP workflow regression guards', () => {
  test('checks both packages on PRs and skips draft work', async () => {
    const { workflow, text } = await readWorkflow('ci.yml');
    expect(Object.keys(workflow.jobs)).toHaveLength(3);
    expect(workflow.on.pull_request).toBeDefined();
    expect(workflow.on.push).toBeDefined();
    expect(workflow.concurrency['cancel-in-progress']).toBe(true);
    expect(workflow.jobs.rules.with?.package).toBe('agent-rules-mcp');
    expect(workflow.jobs.codemode.with?.package).toBe('opencode-codemode-mcp');
    for (const job of Object.values(workflow.jobs)) expect(job.if).toContain('draft != true');
    expect(text).toContain("'.github/workflows/**'");
    expect(text).toContain("'.github/tests/**'");
  });

  test('recall, freshness, and native tests precede every deploy', async () => {
    const { workflow } = await readWorkflow('_mcp-checks.yml');
    expect(Object.keys(workflow.jobs)).toEqual(['check']);
    const job = workflow.jobs.check;
    expect(job['timeout-minutes']).toBe(15);
    const steps = job.steps ?? [];
    const setup = steps.find((step) => step.uses?.includes('setup-bun'));
    expect(setup?.with?.['bun-version-file']).toBe('${{ inputs.package }}/package.json');
    expect(setup?.with?.['bun-version']).toBeUndefined();
    const deploy = steps.findIndex((step) => step.name === 'Deploy Worker');
    expect(deploy).toBeGreaterThan(0);
    expect(steps[deploy].run).toContain('--tag "$GITHUB_SHA"');
    expect(steps[deploy].run).toContain(
      '--message "source=$SOURCE_DIGEST artifact=$ARTIFACT_DIGEST"',
    );
    for (const command of ['bun run build:check', 'bun run eval:check', 'bun run test']) {
      const gate = steps.findIndex((step) => step.run?.includes(command));
      expect(gate).toBeGreaterThanOrEqual(0);
      expect(gate).toBeLessThan(deploy);
    }
    const { workflow: release } = await readWorkflow('deploy-agent-rules-mcp.yml');
    expect(Object.keys(release.jobs)).toEqual(['deploy']);
    expect(release.on.pull_request).toBeUndefined();
    expect(release.concurrency['cancel-in-progress']).toBe(false);
    expect(release.jobs.deploy.uses).toBe('./.github/workflows/_mcp-checks.yml');
    expect(release.jobs.deploy.with?.deploy).toBe(true);
  });

  test('pins external actions and bounds every runner job', async () => {
    for (const name of ['ci.yml', '_mcp-checks.yml', 'deploy-agent-rules-mcp.yml']) {
      const { workflow, text } = await readWorkflow(name);
      for (const line of text.split('\n').filter((line) => /uses: (?!\.\/)/.test(line))) {
        expect(line).toMatch(/@[a-f0-9]{40} # v/);
      }
      for (const job of Object.values(workflow.jobs)) {
        if (job['runs-on']) expect(job['timeout-minutes']).toBeGreaterThan(0);
      }
    }
  });
});
