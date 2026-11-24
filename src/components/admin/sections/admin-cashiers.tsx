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
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const [dialog, setDialog] = useState<EditTarget>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null);

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
      setDeleteTarget(null);
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
        <Button onClick={() => setDialog({ mode: "add" })}>
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
          {isLoading ? (
            <TableSkeleton rows={6} columns={6} />
          ) : (users?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No staff accounts found.
            </p>
          ) : (
            <div className="rounded-md">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Sales recorded</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users!.map((u) => {
                    const isMe = session?.user?.id === u.id;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.username}
                          {isMe && (
                            <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[9px]">
                              you
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.name ?? <span className="italic opacity-60">—</span>}
                        </TableCell>
                        <TableCell>
                          {u.role === "admin" ? (
                            <Badge className="gap-1">
                              <ShieldCheck className="h-3 w-3" /> Admin
                            </Badge>
                          ) : (
                            <Badge variant="outline">Cashier</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {u._count?.sales ?? 0}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(u.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setDialog({ mode: "edit", user: u })}
                              aria-label={`Edit ${u.username}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(u)}
                              disabled={isMe}
                              aria-label={`Delete ${u.username}`}
                              title={isMe ? "You cannot delete your own account" : "Delete account"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
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
        target={dialog}
        onClose={() => setDialog(null)}
        onSaved={() => {
          setDialog(null);
          qc.invalidateQueries({ queryKey: ["users"] });
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.username}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The account will no longer be able to sign in. Sales they already recorded
              keep their name in the audit trail. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Add / edit staff account dialog (create = add cashier or admin; edit =
 *  rename, change role, reset password). */
function StaffDialog({
  target,
  onClose,
  onSaved,
}: {
  target: EditTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
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
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit account" : "Add cashier"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update details or set a new password (leave blank to keep the current one)."
              : "The cashier signs in on the same screen with these credentials."}
          </DialogDescription>
        </DialogHeader>
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
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cashier">Cashier — POS checkout only</SelectItem>
                <SelectItem value="admin">Admin — full access</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
