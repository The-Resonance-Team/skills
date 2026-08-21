#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadDesignToken } from './auth.js';

const DESIGN_MCP_URL = process.env.DESIGN_MCP_URL || 'https://api.anthropic.com/v1/design/mcp';

async function main() {
  // Load token
  const token = loadDesignToken();
  console.error(`[proxy] Loaded design token (scopes: ${token.scopes?.join(', ') || 'unknown'})`);

  // Connect to remote Design MCP
  const url = new URL(DESIGN_MCP_URL);
  const httpTransport = new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
      },
    },
  });

  const remoteClient = new Client(
    { name: 'design-mcp-proxy', version: '0.1.0' },
    { capabilities: {} }
  );

  console.error(`[proxy] Connecting to ${DESIGN_MCP_URL}...`);
  await remoteClient.connect(httpTransport);
  console.error('[proxy] Connected to Design MCP');

  // Create local stdio server
  const localServer = new Server(
    { name: 'design-mcp-proxy', version: '0.1.0' },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // Proxy tools
  localServer.setRequestHandler(ListToolsRequestSchema, async () => {
    const result = await remoteClient.listTools();
    return result;
  });

  localServer.setRequestHandler(CallToolRequestSchema, async (req) => {
    const result = await remoteClient.callTool({
      name: req.params.name,
      arguments: req.params.arguments,
    });
    return result;
  });

  // Proxy resources
  localServer.setRequestHandler(ListResourcesRequestSchema, async () => {
    const result = await remoteClient.listResources();
    return result;
  });

  localServer.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const result = await remoteClient.readResource(req.params);
    return result;
  });

  localServer.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    const result = await remoteClient.listResourceTemplates();
    return result;
  });

  // Proxy prompts
  localServer.setRequestHandler(ListPromptsRequestSchema, async () => {
    const result = await remoteClient.listPrompts();
    return result;
  });

  localServer.setRequestHandler(GetPromptRequestSchema, async (req) => {
    const result = await remoteClient.getPrompt(req.params);
    return result;
  });

  // Connect stdio
  const stdioTransport = new StdioServerTransport();
  await localServer.connect(stdioTransport);
  console.error('[proxy] Stdio server ready');
}

main().catch((err) => {
  console.error('[proxy] Fatal:', err);
  process.exit(1);
});
