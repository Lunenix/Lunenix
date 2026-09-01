"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { InvoiceSheet } from "@/components/invoices/InvoiceSheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Calendar,
  Download,
  FileText,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import {
  Invoice,
  INVOICE_STATUS_LABELS,
  Contact,
  Contract,
  Project,
  contactDisplayName,
} from "@/types/database";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { invoiceStatusClasses } from "@/lib/status";

interface InvoiceDetailPageProps {
  params: { id: string };
}

export default function InvoiceDetailPage({
  params,
}: InvoiceDetailPageProps) {
  const { id } = params;
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id && activeWorkspace?.id) {
      fetchData();
    }
  }, [id, activeWorkspace?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invoiceRes, contactsRes, contractsRes, projectsRes] =
        await Promise.all([
          fetch(`/api/invoices/${id}`),
          fetch(`/api/contacts?workspaceId=${activeWorkspace?.id}`),
          fetch(`/api/contracts?workspaceId=${activeWorkspace?.id}`),
          fetch(`/api/projects?workspaceId=${activeWorkspace?.id}`),
        ]);

      const [invoiceData, contactsData, contractsData, projectsData] =
        await Promise.all([
          invoiceRes.json(),
          contactsRes.json(),
          contractsRes.json(),
          projectsRes.json(),
        ]);

      setInvoice(invoiceData.invoice);
      setContacts(contactsData.contacts || []);
      setContracts(contractsData.contracts || []);
      setProjects(projectsData.projects || []);
    } catch (error) {
      console.error("Error fetching invoice:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;
    if (
      !confirm(
        `Are you sure you want to delete invoice "${invoice.invoice_number}"? This action cannot be undone.`
      )
    )
      return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete invoice");
      router.push("/invoices");
    } catch (error) {
      console.error("Error deleting invoice:", error);
      alert("Failed to delete invoice");
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!invoice || !activeWorkspace?.id) return;
    const qs = new URLSearchParams({ workspaceId: activeWorkspace.id });
    window.open(`/api/invoices/${invoice.id}/pdf?${qs.toString()}`, "_blank");
  };

  const handleMarkAsPaid = async () => {
    if (!invoice) return;
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
      if (!res.ok) throw new Error("Failed to mark as paid");
      fetchData();
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      alert("Failed to mark invoice as paid");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Invoice not found</p>
        <Button asChild>
          <Link href="/invoices">Back to Invoices</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link href="/invoices">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Invoices
            </Link>
          </Button>
          <div className="flex items-start gap-3">
            <h1 className="text-3xl font-bold">{invoice.invoice_number}</h1>
            <Badge className={invoiceStatusClasses(invoice.status)}>
              {INVOICE_STATUS_LABELS[invoice.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {invoice.contact ? contactDisplayName(invoice.contact) : "No contact"}
          </p>
        </div>
        <div className="flex gap-2">
          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
            <Button variant="outline" onClick={handleMarkAsPaid}>
              Mark as Paid
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" disabled={deleting}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSheetOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadPdf}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Invoice Details Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {invoice.contact && (
              <div className="flex items-start gap-3">
                <User className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Bill To</p>
                  <p className="text-sm text-muted-foreground">
                    {contactDisplayName(invoice.contact)}
                  </p>
                  {invoice.contact.email && (
                    <p className="text-xs text-muted-foreground">
                      {invoice.contact.email}
                    </p>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Dates</p>
                <p className="text-sm text-muted-foreground">
                  Issued: {formatDate(invoice.issue_date)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Due: {formatDate(invoice.due_date)}
                </p>
                {invoice.paid_at && (
                  <p className="text-sm text-muted-foreground">
                    Paid: {formatDateTime(invoice.paid_at)}
                  </p>
                )}
              </div>
            </div>
            {invoice.contract && (
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Contract</p>
                  <Link
                    href={`/contracts/${invoice.contract.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {invoice.contract.contract_number} -{" "}
                    {invoice.contract.name}
                  </Link>
                </div>
              </div>
            )}
            {invoice.payment_terms && (
              <div>
                <p className="text-sm font-medium">Payment Terms</p>
                <p className="text-sm text-muted-foreground">
                  {invoice.payment_terms}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Amount Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">
                {formatCurrency(invoice.subtotal, invoice.currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Tax ({invoice.tax_rate}%)
              </span>
              <span className="font-medium">
                {formatCurrency(invoice.tax_amount, invoice.currency)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-3 text-lg font-bold">
              <span>Total</span>
              <span>{formatCurrency(invoice.total, invoice.currency)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.line_items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unit_price, invoice.currency)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.amount, invoice.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Notes */}
      {invoice.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {invoice.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-6 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">Created:</span>{" "}
              {formatDateTime(invoice.created_at)}
            </div>
            <div>
              <span className="font-medium">Updated:</span>{" "}
              {formatDateTime(invoice.updated_at)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Sheet */}
      <InvoiceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        workspaceId={invoice.workspace_id}
        contacts={contacts}
        contracts={contracts}
        projects={projects}
        invoice={invoice}
        onSaved={fetchData}
      />
    </div>
  );
}
