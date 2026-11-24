"use client";

/**
 * OpenStore — Cashiers section (ADMIN ONLY).
 *
 * Manage staff accounts: add as many cashiers as you need, rename them,
 * reset passwords, promote/demote, or remove them.
 *
 * Why it matters for audit: every sale (and stock-in / loss / expense) is
 * stamped with the signed-in user, so the admin can always see WHO made each
 * transaction — cashier or admin (see the "By" column in POS & reports).
 */
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserRoundPlus,
  Pencil,
  Trash2,
  Loader2,
  KeyRound,
  UserCog,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/common/table.component";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Modal, { useModal, type ModalState } from "@/components/common/modal.component";
import SelectInput from "@/components/common/select.component";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { SectionHeading } from "@/components/admin/sections/admin-expenses";

type StaffUser = {
  id: string;
  username: string;
  name: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  _count?: { sales: number };
};

/** Dialog state: "add" a new account, or "edit" an existing one. */
type EditTarget =
  | { mode: "add" }
  | { mode: "edit"; user: StaffUser }
  | null;

export function AdminCashiers() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const staffModal = useModal<Exclude<EditTarget, null>>();
  const deleteModal = useModal<StaffUser>();

  const { data: users, isLoading } = useQuery<StaffUser[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const r = await fetch("/api/users");
      if (!r.ok) throw new Error("Failed to load staff accounts");
      return r.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Failed to delete account");
      }
    },
    onSuccess: () => {
      toast.success("Account deleted. Past transactions keep the audit trail.");
      deleteModal.closeFn();
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cashiers = (users ?? []).filter((u) => u.role === "cashier");
  const admins = (users ?? []).filter((u) => u.role === "admin");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading
          title="Cashiers"
          subtitle="Add cashier accounts for your staff. Every transaction they record is stamped with their name for auditing."
        />
        <Button onClick={() => staffModal.openFn({ mode: "add" })}>
          <UserRoundPlus className="mr-2 h-4 w-4" /> Add cashier
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCog className="h-4 w-4" /> Staff accounts
          </CardTitle>
          <div className="flex gap-1.5">
            <Badge variant="secondary">{admins.length} admin(s)</Badge>
            <Badge variant="secondary">{cashiers.length} cashier(s)</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={users ?? []}
            isLoading={isLoading}
            emptyState={
              <p className="py-8 text-center text-sm text-muted-foreground">
                No staff accounts found.
              </p>
            }
            rowKey={(user) => user.id}
            className="min-w-[640px]"
            columns={[
              {
                header: "Username",
                className: "font-medium",
                render: (user) => (
                  <>
                    {user.username}
                    {session?.user?.id === user.id && (
                      <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[9px]">
                        you
                      </Badge>
                    )}
                  </>
                ),
              },
              {
                header: "Name",
                className: "text-muted-foreground",
                render: (user) =>
                  user.name ?? <span className="italic opacity-60">—</span>,
              },
              {
                header: "Role",
                render: (user) =>
                  user.role === "admin" ? (
                    <Badge className="gap-1">
                      <ShieldCheck className="h-3 w-3" /> Admin
                    </Badge>
                  ) : (
                    <Badge variant="outline">Cashier</Badge>
                  ),
              },
              {
                header: "Sales recorded",
                className: "text-right tabular-nums text-muted-foreground",
                render: (user) => user._count?.sales ?? 0,
              },
              {
                header: "Added",
                className: "whitespace-nowrap text-xs text-muted-foreground",
                render: (user) => formatDate(user.createdAt),
              },
              {
                header: "",
                headerClassName: "w-24",
                render: (user) => {
                  const isMe = session?.user?.id === user.id;
                  return (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => staffModal.openFn({ mode: "edit", user })}
                        aria-label={`Edit ${user.username}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteModal.openFn(user)}
                        disabled={isMe}
                        aria-label={`Delete ${user.username}`}
                        title={isMe ? "You cannot delete your own account" : "Delete account"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                },
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How cashier access works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Cashiers sign in on the same screen and land directly on the POS / Checkout
            page. They can record sales and see the most recent transactions — nothing else.
          </p>
          <p>
            Inventory, stock-in, losses, expenses, reports and this page are admin-only,
            protected on the server (not just hidden in the UI).
          </p>
          <p>
            Every sale is stamped with the signed-in staff member, so the weekly audit
            report always shows who made each transaction — cashier or admin.
          </p>
        </CardContent>
      </Card>

      <StaffDialog
        controller={staffModal}
        onSaved={() => {
          staffModal.closeFn();
          qc.invalidateQueries({ queryKey: ["users"] });
        }}
      />

      <Modal
        controller={deleteModal}
        title={`Delete “${deleteModal.data?.username ?? ""}”?`}
        size="sm"
        closable
      >
        <p className="mb-6 text-sm text-muted-foreground">
          The account will no longer be able to sign in. Sales they already recorded keep
          their name in the audit trail. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={deleteModal.closeFn}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (deleteModal.data) deleteMutation.mutate(deleteModal.data.id);
            }}
          >
            {deleteMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/** Add / edit staff account dialog (create = add cashier or admin; edit =
 *  rename, change role, reset password). */
function StaffDialog({
  controller,
  onSaved,
}: {
  controller: ModalState<Exclude<EditTarget, null>>;
  onSaved: () => void;
}) {
  const target = controller.data ?? null;
  const isEdit = target?.mode === "edit";
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("cashier");
  const [key, setKey] = useState(0);

  // Re-seed the form whenever the dialog target changes.
  const seedKey = target ? (target.mode === "edit" ? target.user.id : "add") : "closed";
  const [lastSeed, setLastSeed] = useState("");
  if (seedKey !== lastSeed) {
    setLastSeed(seedKey);
    setKey((k) => k + 1);
    if (target?.mode === "edit") {
      setUsername(target.user.username);
      setName(target.user.name ?? "");
      setRole(target.user.role);
    } else {
      setUsername("");
      setName("");
      setRole("cashier");
    }
    setPassword("");
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        username: username.trim(),
        name: name.trim(),
        role,
      };
      if (password) body.password = password;

      const r = await fetch(
        isEdit && target?.mode === "edit" ? `/api/users/${target.user.id}` : "/api/users",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Failed to save account");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success(isEdit ? "Account updated" : `Account created — ${username.trim()} can now sign in`);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return toast.error("Username is required");
    if (!isEdit && password.length < 6)
      return toast.error("Password must be at least 6 characters");
    saveMutation.mutate();
  }

  return (
    <Modal controller={controller} title={isEdit ? "Edit account" : "Add cashier"} size="sm" closable>
      <p className="mb-4 text-sm text-muted-foreground">
        {isEdit
          ? "Update details or set a new password (leave blank to keep the current one)."
          : "The cashier signs in on the same screen with these credentials."}
      </p>
        <form onSubmit={submit} className="space-y-3" key={key}>
          <div className="space-y-1.5">
            <Label htmlFor="cash-username">Username</Label>
            <Input
              id="cash-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. maria"
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cash-name">Display name (optional)</Label>
            <Input
              id="cash-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maria Santos"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Shown on sales records — e.g. “Recorded by Maria Santos”.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cash-password">
              {isEdit ? "New password (optional)" : "Password"}
            </Label>
            <div className="relative">
              <KeyRound className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="cash-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEdit ? "Leave blank to keep current" : "min. 6 characters"}
                className="pl-8"
                autoComplete="new-password"
                required={!isEdit}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <SelectInput
              value={role}
              onChange={setRole}
              options={[
                { label: "Cashier — POS checkout only", value: "cashier" },
                { label: "Admin — full access", value: "admin" },
              ]}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={controller.closeFn}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create account"}
            </Button>
          </div>
        </form>
    </Modal>
  );
}
