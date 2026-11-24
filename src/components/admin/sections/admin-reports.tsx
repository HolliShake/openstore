"use client";

/**
 * OpenStore — Reports section.
 * Links to printable app routes (/report and /price-list), which
 * fetch their data from JSON APIs and render as real pages.
 */
import { useState } from "react";
import Link from "next/link";
import { FileText, ListOrdered, ExternalLink, Printer, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SelectInput from "@/components/common/select.component";
import { SectionHeading } from "@/components/admin/sections/admin-expenses";

export function AdminReports() {
  const [week, setWeek] = useState("0");

  const weekOptions = [
    { value: "0", label: "This week" },
    { value: "1", label: "Last week" },
    { value: "2", label: "2 weeks ago" },
    { value: "3", label: "3 weeks ago" },
    { value: "4", label: "4 weeks ago" },
  ];

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Reports & Printables"
        subtitle="Open a printable page in a new tab, then use your browser's Print dialog (Ctrl+P / Cmd+P) to save as PDF or print."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Weekly report */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Weekly audit report</CardTitle>
            </div>
            <CardDescription>
              One-page summary: revenue, cost of products sold (COGS), gross profit, losses,
              expenses, net profit,
              sales/loss/expense tables, and a stock-value snapshot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Week:</span>
              <SelectInput
                value={week}
                onChange={setWeek}
                className="w-44"
                options={weekOptions.map((o) => ({
                  label: o.label,
                  value: o.value,
                }))}
              />
            </div>
            <Button asChild className="w-full">
              <Link
                href={`/report?week=${week}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open weekly report
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Price list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Customer price list</CardTitle>
            </div>
            <CardDescription>
              Printable A4 price list grouped by category. Post it at the store so customers
              can see current prices at a glance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/price-list" target="_blank" rel="noopener noreferrer">
                <Printer className="mr-2 h-4 w-4" />
                Open price list
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Grocery / restock list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Grocery / restock list</CardTitle>
            </div>
            <CardDescription>
              What to buy on your next grocery run, ranked by priority: out-of-stock and
              fast-selling items first. Includes suggested quantities and an estimated
              budget, with checkboxes you can tick while shopping.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link
                href="/restock-list"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Printer className="mr-2 h-4 w-4" />
                Open grocery list
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How revenue &amp; loss are computed</CardTitle>
          <CardDescription>Plain-English summary of the audit logic.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Revenue</strong> = sum of every sale recorded
            through the POS Checkout tab (quantity × sell price at time of sale).
          </p>
          <p>
            <strong className="text-foreground">Cost of Goods Sold (COGS)</strong> — simply,
            what the products you sold cost you. It is calculated for each item as
            (weighted-average unit cost × quantity). Every stock-in blends its purchase price
            into the product&apos;s average cost, so buying the same item at different stores
            and different prices is fully covered. The cost is snapshotted onto each sale, so
            historical reports never change.
          </p>
          <p>
            <strong className="text-foreground">Gross profit</strong> = Revenue − cost of
            products sold (COGS).
          </p>
          <p>
            <strong className="text-foreground">Losses</strong> = sum of every Loss entry
            (spoilage / damage / expired / missing), valued at the unit cost captured at the time
            of loss. Use the Losses tab to record these as they happen.
          </p>
          <p>
            <strong className="text-foreground">Expenses</strong> = costs beyond the products
            themselves (utilities, transport, rent, supplies). Recorded in the Expenses tab.
          </p>
          <p>
            <strong className="text-foreground">Net profit</strong> = Gross profit − Losses −
            Expenses.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
