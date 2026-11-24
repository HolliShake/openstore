"use client";

/**
 * OpenStore — Expenses section.
 * List expenses with create form and delete. Non-COGS costs (utilities, transport, etc).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { queryKeys } from "@/lib/query-client";
import { formatDateTime } from "@/lib/format";
import { useMoney } from "@/hooks/use-money";
import { EXPENSE_CATEGORIES, expenseCategoryLabel } from "@/lib/constants";
import { toast } from "sonner";

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  createdBy: string | null;
  createdAt: string;
};

export function AdminExpenses() {
  const { money, symbol } = useMoney(); // configured currency
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("other");

  const { data: expenses, isLoading } = useQuery<Expense[]>({
    queryKey: queryKeys.expenses,
    queryFn: async () => {
      const r = await fetch("/api/expenses");
      if (!r.ok) throw new Error("Failed to load expenses");
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: { description: string; amount: number; category: string }) => {
      const r = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Failed to create expense");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Expense recorded");
      qc.invalidateQueries({ queryKey: queryKeys.expenses });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard() });
      setDescription("");
      setAmount("");
      setCategory("other");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to delete expense");
    },
    onSuccess: () => {
      toast.success("Expense deleted");
      qc.invalidateQueries({ queryKey: queryKeys.expenses });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = (expenses ?? []).reduce((s, e) => s + e.amount, 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!description.trim() || Number.isNaN(amt) || amt < 0) {
      toast.error("Enter a description and a valid amount");
      return;
    }
    createMutation.mutate({ description: description.trim(), amount: amt, category });
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Expenses"
        subtitle="Record non-COGS costs (utilities, transport, rent, supplies). These reduce net profit."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add expense</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_140px_180px_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="exp-desc">Description</Label>
              <Input
                id="exp-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Electricity bill"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-amt">Amount ({symbol})</Label>
              <Input
                id="exp-amt"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                Add
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent expenses</CardTitle>
          <Badge variant="secondary">Total: {money(total)}</Badge>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={6} columns={6} />
          ) : (expenses?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No expenses recorded yet.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-md">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses!.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(e.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">{e.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {expenseCategoryLabel(e.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {e.createdBy ?? <span className="italic opacity-60">unknown</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {money(e.amount)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(e.id)}
                          disabled={deleteMutation.isPending}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
