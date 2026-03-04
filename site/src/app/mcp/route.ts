import { NextResponse } from "next/server";

type JsonRpcId = string | number | null;

type JsonRpcSuccess = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
};

type JsonRpcError = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

function success(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function error(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcError {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  };
}

export async function GET() {
  return new Response(
    "RelayOrb MCP endpoint. Send JSON-RPC 2.0 POST requests to this path. Supported methods: initialize, tools/list.",
    {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    },
  );
}

export async function POST(req: Request) {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(error(null, -32700, "Parse error"), { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json(error(null, -32600, "Invalid Request"), {
      status: 400,
    });
  }

  const record = payload as Record<string, unknown>;
  const id: JsonRpcId =
    typeof record.id === "string" || typeof record.id === "number"
      ? record.id
      : record.id === null
        ? null
        : null;
  const method = record.method;
  const jsonrpc = record.jsonrpc;

  if (jsonrpc !== "2.0" || typeof method !== "string") {
    return NextResponse.json(error(id, -32600, "Invalid Request"), { status: 400 });
  }

  if (method === "initialize") {
    const result = {
      protocolVersion: "2024-11-05",
      serverInfo: {
        name: "relayorb-mcp",
        version: "0.1.2",
      },
      capabilities: {
        tools: {},
      },
      instructions:
        "RelayOrb currently exposes machine discovery metadata here. Use OpenAPI for callable HTTP endpoints and RelayOrb docs for operational guidance.",
    };

    return NextResponse.json(success(id, result), { status: 200 });
  }

  if (method === "tools/list") {
    return NextResponse.json(success(id, { tools: [] }), { status: 200 });
  }

  return NextResponse.json(error(id, -32601, "Method not found"), { status: 404 });
}
