/**
 * OpenStore — Upload product image (admin).
 * Accepts multipart/form-data with field "file" (image).
 * Stores under /public/uploads. Returns the public URL path.
 *
 * Body size cap: ~3MB. Files are renamed to <cuid>.<ext>.
 */
import { NextRequest } from "next/server";
import { ok, badRequest, serverError, withAdmin } from "@/lib/api";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 3 * 1024 * 1024;

export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("Missing 'file' field");
    if (!ALLOWED.includes(file.type)) return badRequest("Only PNG / JPEG / WEBP / GIF allowed");
    if (file.size > MAX_BYTES) return badRequest("File too large (max 3MB)");

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const filename = `${randomUUID()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const fullPath = path.join(dir, filename);
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, bytes);

    return ok({ url: `/uploads/${filename}`, size: bytes.length });
  } catch (e) {
    return serverError("Upload failed", e);
  }
});
