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
import SelectInput from "@/components/common/select.component";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/common/table.component";
import { queryKeys } from "@/lib/query-client";
import { DEFAULT_PAGE_SIZE, type PaginationResult } from "@/lib/pagination";
import { formatDateTime } from "@/lib/format";
import { useMoney } from "@/hooks/use-money";
import { EXPENSE_CATEGORIES, expenseCategoryLabel } from "@/lib/constants";
import { toast } from "sonner";
import { useModal } from "@/components/common/modal.component";
import ConfirmModal from "@/components/common/confirm.component";

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  createdBy: string | null;
  createdAt: string;
};

type ExpensePage = PaginationResult<Expense> & { totalAmount: number };

export function AdminExpenses() {
  const { money, symbol } = useMoney(); // configured currency
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [page, setPage] = useState(1);
  const deleteModal = useModal<Expense>();

  const { data: expenses, isLoading } = useQuery<ExpensePage>({
    queryKey: [...queryKeys.expenses, page],
    queryFn: async () => {
      const r = await fetch(`/api/expenses?page=${page}&pageSize=${DEFAULT_PAGE_SIZE}`);
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
      setPage(1);
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
      deleteModal.closeFn();
      qc.invalidateQueries({ queryKey: queryKeys.expenses });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard() });
      if ((expenses?.items.length ?? 0) === 1 && page > 1) setPage(page - 1);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = expenses?.totalAmount ?? 0;

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
        subtitle="Record operating costs beyond product purchases, such as utilities, transport, rent, and supplies. These reduce net profit."
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
              <SelectInput
                value={category}
                onChange={setCategory}
                options={EXPENSE_CATEGORIES.map((c) => ({
                  label: c.label,
                  value: c.value,
                }))}
              />
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
          <DataTable
            data={expenses?.items ?? []}
            isLoading={isLoading}
            pagination={{
              page,
              pageSize: DEFAULT_PAGE_SIZE,
              total: expenses?.total ?? 0,
              onPageChange: setPage,
            }}
            emptyState={
              <p className="py-8 text-center text-sm text-muted-foreground">
                No expenses recorded yet.
              </p>
            }
            rowKey={(expense) => expense.id}
            className="min-w-[640px]"
            containerClassName="max-h-96 rounded-md"
            columns={[
              {
                header: "When",
                className: "whitespace-nowrap text-xs text-muted-foreground",
                render: (expense) => formatDateTime(expense.createdAt),
              },
              {
                header: "Description",
                className: "font-medium",
                render: (expense) => expense.description,
              },
              {
                header: "Category",
                render: (expense) => (
                  <Badge variant="outline">
                    {expenseCategoryLabel(expense.category)}
                  </Badge>
                ),
              },
              {
                header: "By",
                className: "text-xs text-muted-foreground",
                render: (expense) =>
                  expense.createdBy ?? <span className="italic opacity-60">unknown</span>,
              },
              {
                header: "Amount",
                headerClassName: "text-right",
                className: "text-right tabular-nums font-medium",
                render: (expense) => money(expense.amount),
              },
              {
                header: "",
                headerClassName: "w-10",
                render: (expense) => (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteModal.openFn(expense)}
                    disabled={deleteMutation.isPending}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
      <ConfirmModal
        state={deleteModal}
        title="Delete expense?"
        description={(expense) =>
          `Delete the expense “${expense?.description ?? ""}”? This cannot be undone.`
        }
        confirmLabel="Delete expense"
        isLoading={deleteMutation.isPending}
        onConfirm={(expense) => deleteMutation.mutate(expense.id)}
      />
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
