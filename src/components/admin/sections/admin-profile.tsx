"use client";

import { useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, UserRound } from "lucide-react";
import { SectionHeading } from "@/components/admin/sections/admin-expenses";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Profile = {
  username: string;
  name: string | null;
  role: string;
};

type ProfileUpdate = {
  currentPassword: string;
  name?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export function AdminProfile() {
  const { update } = useSession();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState<string | undefined>();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: async () => {
      const response = await fetch("/api/profile");
      if (!response.ok) throw new Error("Failed to load profile");
      return response.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: ProfileUpdate) => {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Failed to update profile");
      }
      return response.json() as Promise<Profile>;
    },
    onSuccess: async (updatedProfile) => {
      queryClient.setQueryData(["profile"], updatedProfile);
      setFullName(updatedProfile.name ?? "");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await update();
      toast.success("Profile updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    const name = (fullName ?? profile.name ?? "").trim();
    const nameChanged = name !== (profile.name ?? "");
    if (nameChanged && !name) {
      toast.error("Full name is required");
      return;
    }
    if (!nameChanged && !newPassword) {
      toast.error("Change your full name or enter a new password");
      return;
    }
    if (!currentPassword) {
      toast.error("Enter your current password to confirm these changes");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }

    updateMutation.mutate({
      currentPassword,
      ...(nameChanged ? { name } : {}),
      ...(newPassword ? { newPassword, confirmPassword } : {}),
    });
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Profile"
        subtitle="Update your staff name or password. Your current password is required to save changes."
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Personal details</CardTitle>
          </div>
          <CardDescription>
            Your name is shown on transactions you record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading profile…
            </div>
          ) : profile ? (
            <form onSubmit={submit} className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3">
                <div>
                  <p className="text-sm font-medium">{profile.username}</p>
                  <p className="text-xs text-muted-foreground">Username</p>
                </div>
                <Badge variant="secondary">{profile.role}</Badge>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-full-name">Full name</Label>
                <Input
                  id="profile-full-name"
                  value={fullName ?? profile.name ?? ""}
                  onChange={(event) => setFullName(event.target.value)}
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Enter your full name"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-current-password">Current password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="profile-current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    className="pl-9"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Verify your identity before changing account details.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-new-password">New password</Label>
                  <Input
                    id="profile-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    placeholder="Leave blank to keep current"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="profile-confirm-password">Confirm new password</Label>
                  <Input
                    id="profile-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>

              <div className="flex justify-end border-t pt-4">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save changes
                </Button>
              </div>
            </form>
          ) : (
            <p className="py-4 text-sm text-destructive">
              Profile could not be loaded. Refresh the page and try again.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
