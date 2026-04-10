export const dynamic = "force-dynamic";

import { clearAuthCookie } from "@/lib/auth";
import { ok } from "@/lib/http";

export async function POST() {
  clearAuthCookie();
  return ok({ success: true });
}
