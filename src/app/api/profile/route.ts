import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { badRequest, notFound, ok, readJson, serverError, unauthorized, withStaff } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";

type ProfileUpdate = {
  currentPassword?: unknown;
  name?: unknown;
  newPassword?: unknown;
  confirmPassword?: unknown;
};

const PROFILE_SELECT = {
  username: true,
  name: true,
  role: true,
} as const;

export const GET = withStaff(async () => {
  try {
    const staff = await getAuthUser();
    if (!staff) return unauthorized("You must be signed in.");

    const profile = await db.user.findUnique({
      where: { id: staff.id },
      select: PROFILE_SELECT,
    });
    if (!profile) return notFound("Staff account not found.");

    return ok(profile);
  } catch (e) {
    return serverError("Failed to load profile", e);
  }
});

export const PATCH = withStaff(async (req: NextRequest) => {
  const { data, error } = await readJson<ProfileUpdate>(req);
  if (error) return badRequest(error);
  if (!data) return badRequest("Missing body");

  if (typeof data.currentPassword !== "string" || !data.currentPassword) {
    return badRequest("Enter your current password to confirm these changes.");
  }

  const nameProvided = data.name !== undefined;
  let name: string | undefined;
  if (nameProvided) {
    if (typeof data.name !== "string") return badRequest("Full name must be text.");
    name = data.name.trim();
    if (!name) return badRequest("Full name is required.");
    if (name.length > 100) return badRequest("Full name must be 100 characters or fewer.");
  }

  let newPassword: string | undefined;
  if (data.newPassword !== undefined && data.newPassword !== "") {
    if (typeof data.newPassword !== "string") return badRequest("New password must be text.");
    if (data.newPassword.length < 6) {
      return badRequest("New password must be at least 6 characters.");
    }
    if (data.confirmPassword !== data.newPassword) {
      return badRequest("New password and confirmation do not match.");
    }
    newPassword = data.newPassword;
  } else if (data.confirmPassword !== undefined && data.confirmPassword !== "") {
    return badRequest("Enter a new password to use the confirmation field.");
  }

  if (!nameProvided && !newPassword) return badRequest("No profile changes were provided.");

  try {
    const staff = await getAuthUser();
    if (!staff) return unauthorized("You must be signed in.");

    const currentUser = await db.user.findUnique({
      where: { id: staff.id },
      select: { id: true, password: true },
    });
    if (!currentUser) return notFound("Staff account not found.");

    const passwordMatches = await bcrypt.compare(data.currentPassword, currentUser.password);
    if (!passwordMatches) return badRequest("Current password is incorrect.");

    const update: { name?: string; password?: string } = {};
    if (name !== undefined) update.name = name;
    if (newPassword) update.password = await bcrypt.hash(newPassword, 10);

    const profile = await db.user.update({
      where: { id: currentUser.id },
      data: update,
      select: PROFILE_SELECT,
    });
    return ok(profile);
  } catch (e) {
    return serverError("Failed to update profile", e);
  }
});
