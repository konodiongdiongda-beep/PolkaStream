import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["server.mjs"],
    cwd: process.cwd(),
    env: {
      ...process.env,
      POLKASTREAM_MCP_RPC_URL: process.env.POLKASTREAM_MCP_RPC_URL ?? "http://127.0.0.1:8545",
      POLKASTREAM_MCP_POLKASTREAM_ADDRESS:
        process.env.POLKASTREAM_MCP_POLKASTREAM_ADDRESS ?? "0x0000000000000000000000000000000000001234",
      POLKASTREAM_MCP_API_BASE_URL: process.env.POLKASTREAM_MCP_API_BASE_URL ?? "http://127.0.0.1:8787",
    },
  });

  const client = new Client({ name: "polkastream-agent-mcp-smoke", version: "0.1.0" }, { capabilities: {} });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const runtime = await client.callTool({ name: "get_runtime_config", arguments: {} });

    console.log(
      JSON.stringify(
        {
          ok: true,
          toolCount: tools.tools.length,
          sampleTools: tools.tools.slice(0, 8).map((tool) => tool.name),
          runtime,
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("[agent-mcp smoke] failed", error);
  process.exit(1);
});
