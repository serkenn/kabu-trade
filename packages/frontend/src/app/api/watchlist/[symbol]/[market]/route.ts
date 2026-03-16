import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:4000";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string; market: string }> }
) {
  const { symbol, market } = await params;
  const res = await fetch(
    `${BACKEND}/api/watchlist/${encodeURIComponent(symbol)}/${encodeURIComponent(market)}`,
    {
      method: "DELETE",
      headers: { cookie: req.headers.get("cookie") || "" },
    }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
