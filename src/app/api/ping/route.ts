import { NextResponse } from "next/server";

// Lightweight connectivity probe — used by the offline/online detection logic.
// The client fetches this with a short timeout; if it succeeds the device
// actually has a working internet connection, not just a LAN link.
export async function GET() {
  return NextResponse.json(
    { ok: true, ts: Date.now() },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
