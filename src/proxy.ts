import { NextResponse, type NextRequest } from "next/server";

const API_SIMULATED_DELAY_MS = 3_000;

export async function proxy(_request: NextRequest) {
  if (process.env.NODE_ENV === "development") {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, API_SIMULATED_DELAY_MS);
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
