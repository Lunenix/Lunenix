"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import type { JobExpense, VendorBill } from "@/types/database";

export default function BooksPage() {
  const { activeWorkspace } = useWorkspace();
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [expenses, setExpenses] = useState<JobExpense[]>([]);
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [expAmt, setExpAmt] = useState("");
  const [expCat, setExpCat] = useState("parts");

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [b, e] = await Promise.all([
      fetch(`/api/vendor-bills?workspaceId=${id}`),
      fetch(`/api/job-expenses?workspaceId=${id}`),
    ]);
    const bj = await b.json();
    const ej = await e.json();
    if (b.ok) setBills(bj.bills ?? []);
    if (e.ok) setExpenses(ej.expenses ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function addBill() {
    if (!activeWorkspace || !vendor.trim() || !amount) return;
    await fetch("/api/vendor-bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        vendor_name: vendor.trim(),
        amount: Number(amount),
        due_date: due || null,
      }),
    });
    setVendor("");
    setAmount("");
    load();
  }

  async function addExpense() {
    if (!activeWorkspace || !expAmt) return;
    await fetch("/api/job-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        category: expCat,
        amount: Number(expAmt),
      }),
    });
    setExpAmt("");
    load();
  }

  async function markPaid(id: string) {
    await fetch(`/api/vendor-bills/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    load();
  }

  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const pendingBills = bills
    .filter((b) => b.status === "pending")
    .reduce((s, b) => s + Number(b.amount), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Books</h1>
        <p className="text-muted-foreground">
          Light AP (vendor bills), job expenses/receipts, and a cash snapshot.
          Log trips on Mileage — those amounts count as field expenses.
        </p>
      </div>
        <p className="text-sm">
          Open vendor bills {formatCurrency(pendingBills)} · Logged expenses{" "}
          {formatCurrency(expenseTotal)}. Profit and tax set-aside live on Field
          ops (paid invoices minus expenses).
        </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Vendor bills</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Vendor"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
          <Input
            className="w-28"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            type="date"
            className="w-40"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          <Button onClick={addBill}>Add bill</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.vendor_name}</TableCell>
                <TableCell>{formatCurrency(Number(b.amount))}</TableCell>
                <TableCell>{b.due_date ?? "—"}</TableCell>
                <TableCell>{b.status}</TableCell>
                <TableCell>
                  {b.status === "pending" ? (
                    <Button size="sm" variant="outline" onClick={() => markPaid(b.id)}>
                      Mark paid
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Job expenses / receipts</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Category (parts, fuel…)"
            value={expCat}
            onChange={(e) => setExpCat(e.target.value)}
          />
          <Input
            className="w-28"
            placeholder="Amount"
            value={expAmt}
            onChange={(e) => setExpAmt(e.target.value)}
          />
          <Button onClick={addExpense}>Add expense</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.incurred_on}</TableCell>
                <TableCell>{e.category}</TableCell>
                <TableCell>{formatCurrency(Number(e.amount))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
