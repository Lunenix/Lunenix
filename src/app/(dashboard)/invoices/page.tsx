"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { InvoiceSheet } from "@/components/invoices/InvoiceSheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Loader2, Plus } from "lucide-react";
import {
  Invoice,
  INVOICE_STATUS_LABELS,
  Contact,
  Contract,
  Project,
  contactDisplayName,
} from "@/types/database";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceStatusClasses } from "@/lib/status";

export default function InvoicesPage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (activeWorkspace?.id) {
      fetchData();
    }
  }, [activeWorkspace?.id]);

  const fetchData = async () => {
    if (!activeWorkspace?.id) return;

    setLoading(true);
    try {
      const [invoicesRes, contactsRes, contractsRes, projectsRes] =
        await Promise.all([
          fetch(`/api/invoices?workspaceId=${activeWorkspace.id}`),
          fetch(`/api/contacts?workspaceId=${activeWorkspace.id}`),
          fetch(`/api/contracts?workspaceId=${activeWorkspace.id}`),
          fetch(`/api/projects?workspaceId=${activeWorkspace.id}`),
        ]);

      const [invoicesData, contactsData, contractsData, projectsData] =
        await Promise.all([
          invoicesRes.json(),
          contactsRes.json(),
          contractsRes.json(),
          projectsRes.json(),
        ]);

      setInvoices(invoicesData.invoices || []);
      setContacts(contactsData.contacts || []);
      setContracts(contractsData.contracts || []);
      setProjects(projectsData.projects || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (workspaceLoading || loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">No active workspace</p>
      </div>
    );
  }

  // Calculate totals
  const totalOutstanding = invoices
    .filter((inv) => inv.status === "sent" || inv.status === "overdue")
    .reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">
            Track and manage your invoices
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Invoice
        </Button>
      </div>

      {/* Summary Cards */}
      {invoices.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">
                Total Outstanding
              </div>
              <div className="mt-2 text-2xl font-bold">
                {formatCurrency(totalOutstanding, "USD")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">
                Total Paid
              </div>
              <div className="mt-2 text-2xl font-bold">
                {formatCurrency(totalPaid, "USD")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">
                Total Invoices
              </div>
              <div className="mt-2 text-2xl font-bold">{invoices.length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No invoices yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Get started by creating your first invoice
            </p>
            <Button onClick={() => setSheetOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Invoices Table */
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} className="cursor-pointer">
                  <TableCell>
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="font-medium hover:underline"
                    >
                      {invoice.invoice_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {invoice.contact
                      ? contactDisplayName(invoice.contact)
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge className={invoiceStatusClasses(invoice.status)}>
                      {INVOICE_STATUS_LABELS[invoice.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(invoice.issue_date)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(invoice.due_date)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(invoice.total, invoice.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Invoice Sheet */}
      <InvoiceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        workspaceId={activeWorkspace.id}
        contacts={contacts}
        contracts={contracts}
        projects={projects}
        onSaved={fetchData}
      />
    </div>
  );
}
