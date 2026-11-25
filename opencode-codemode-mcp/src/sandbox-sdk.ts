export const sdkDefinitions = `
interface CodeModeSdk {
  workflow: {
    /** Create a deployment request for the fixed test fixture. Requires separate human approval. */
    start(): Promise<{ id: string; state: string; account: string; target: string; fixture: string; fixtureHash: string; manifestHash: string }>;
    /** Read deployment and durable workflow status. */
    status(id: string): Promise<unknown>;
  };
}

// Submit an ES module exporting an async function:
// export default async (sdk: CodeModeSdk) => sdk.workflow.start();
`;
