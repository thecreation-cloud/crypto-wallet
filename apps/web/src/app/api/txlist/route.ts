import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Proxy for Etherscan-compatible APIs — avoids CORS when called from the browser
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const apiBase = searchParams.get("apiBase");
  const address = searchParams.get("address");
  const apiKey = searchParams.get("apiKey");
  const limit = searchParams.get("limit") ?? "25";

  if (!apiBase || !address) {
    return NextResponse.json({ status: "0", message: "Missing params", result: [] }, { status: 400 });
  }

  const url = new URL(`${apiBase}/api`);
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "txlist");
  url.searchParams.set("address", address);
  url.searchParams.set("startblock", "0");
  url.searchParams.set("endblock", "99999999");
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", limit);
  url.searchParams.set("sort", "desc");
  if (apiKey) url.searchParams.set("apikey", apiKey);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 30 } });
    const data: unknown = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: "0", message: "Upstream error", result: [] }, { status: 502 });
  }
}
