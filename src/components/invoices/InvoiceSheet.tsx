"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Invoice,
  InvoiceStatus,
  InvoiceLineItem,
  INVOICE_STATUS_LABELS,
  Contact,
  contactDisplayName,
  Contract,
  Project,
} from "@/types/database";

interface InvoiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  contacts: Contact[];
  contracts: Contract[];
  projects: Project[];
  invoice?: Invoice | null;
  onSaved: () => void;
}

export function InvoiceSheet({
  open,
  onOpenChange,
  workspaceId,
  contacts,
  contracts,
  projects,
  invoice,
  onSaved,
}: InvoiceSheetProps) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [contactId, setContactId] = useState<string>("");
  const [contractId, setContractId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [status, setStatus] = useState<InvoiceStatus>("draft");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [taxRate, setTaxRate] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [saving, setSaving] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (invoice) {
      setInvoiceNumber(invoice.invoice_number || "");
      setContactId(invoice.contact_id || "");
      setContractId(invoice.contract_id || null);
      setProjectId(invoice.project_id || null);
      setStatus(invoice.status);
      setIssueDate(invoice.issue_date || "");
      setDueDate(invoice.due_date || "");
      setLineItems(invoice.line_items || []);
      setTaxRate(invoice.tax_rate?.toString() || "0");
      setCurrency(invoice.currency || "USD");
      setNotes(invoice.notes || "");
      setPaymentTerms(invoice.payment_terms || "");
    } else {
      // Reset for new invoice
      setInvoiceNumber("");
      setContactId("");
      setContractId(null);
      setProjectId(null);
      setStatus("draft");
      const today = new Date().toISOString().split("T")[0];
      setIssueDate(today);
      // Default due date 30 days from today
      const due = new Date();
      due.setDate(due.getDate() + 30);
      setDueDate(due.toISOString().split("T")[0]);
      setLineItems([{ description: "", quantity: 1, unit_price: 0, amount: 0 }]);
      setTaxRate("0");
      setCurrency("USD");
      setNotes("");
      setPaymentTerms("Net 30");
    }
  }, [invoice, open]);

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const taxAmount = (subtotal * parseFloat(taxRate || "0")) / 100;
  const total = subtotal + taxAmount;

  const handleLineItemChange = (
    index: number,
    field: keyof InvoiceLineItem,
    value: string | number
  ) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate amount
    if (field === "quantity" || field === "unit_price") {
      const qty = field === "quantity" ? parseFloat(value as string) || 0 : updated[index].quantity;
      const price = field === "unit_price" ? parseFloat(value as string) || 0 : updated[index].unit_price;
      updated[index].amount = qty * price;
    }

    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unit_price: 0, amount: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const handleSave = async () => {
    if (!invoiceNumber.trim() || !contactId || !issueDate || !dueDate) {
      alert("Invoice number, contact, issue date, and due date are required");
      return;
    }

    if (lineItems.length === 0 || lineItems.every(item => !item.description.trim())) {
      alert("Please add at least one line item");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        workspace_id: workspaceId,
        invoice_number: invoiceNumber.trim(),
        contact_id: contactId,
        contract_id: contractId,
        project_id: projectId,
        status,
        issue_date: issueDate,
        due_date: dueDate,
        line_items: lineItems.filter(item => item.description.trim()),
        tax_rate: parseFloat(taxRate || "0"),
        currency,
        notes: notes.trim() || null,
        payment_terms: paymentTerms.trim() || null,
      };

      const url = invoice ? `/api/invoices/${invoice.id}` : "/api/invoices";
      const method = invoice ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save invoice");

      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving invoice:", error);
      alert("Failed to save invoice. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const selectedContact = contacts.find((c) => c.id === contactId);
  const selectedContract = contracts.find((c) => c.id === contractId);
  const selectedProject = projects.find((p) => p.id === projectId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[640px]">
        <SheetHeader>
          <SheetTitle>{invoice ? "Edit Invoice" : "New Invoice"}</SheetTitle>
          <SheetDescription>
            {invoice
              ? "Update invoice details"
              : "Create a new invoice for your workspace"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Invoice Number */}
          <div className="space-y-2">
            <Label htmlFor="invoice-number">
              Invoice Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="invoice-number"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-001"
            />
          </div>

          {/* Contact */}
          <div className="space-y-2">
            <Label>
              Contact <span className="text-destructive">*</span>
            </Label>
            <Popover open={contactOpen} onOpenChange={setContactOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={contactOpen}
                  className="w-full justify-between"
                >
                  {selectedContact
                    ? contactDisplayName(selectedContact)
                    : "Select contact..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px] p-0">
                <Command>
                  <CommandInput placeholder="Search contacts..." />
                  <CommandList>
                    <CommandEmpty>No contact found.</CommandEmpty>
                    <CommandGroup>
                      {contacts.map((contact) => (
                        <CommandItem
                          key={contact.id}
                          value={contactDisplayName(contact)}
                          onSelect={() => {
                            setContactId(contact.id);
                            setContactOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              contactId === contact.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {contactDisplayName(contact)}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Contract (Optional) */}
          <div className="space-y-2">
            <Label>Contract (Optional)</Label>
            <Popover open={contractOpen} onOpenChange={setContractOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={contractOpen}
                  className="w-full justify-between"
                >
                  {selectedContract
                    ? `${selectedContract.contract_number} - ${selectedContract.name}`
                    : "Select contract..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px] p-0">
                <Command>
                  <CommandInput placeholder="Search contracts..." />
                  <CommandList>
                    <CommandEmpty>No contract found.</CommandEmpty>
                    <CommandGroup>
                      {contracts.map((contract) => (
                        <CommandItem
                          key={contract.id}
                          value={`${contract.contract_number} ${contract.name}`}
                          onSelect={() => {
                            setContractId(contract.id);
                            setContractOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              contractId === contract.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {contract.contract_number} - {contract.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {contractId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setContractId(null)}
                className="text-xs"
              >
                Clear contract
              </Button>
            )}
          </div>

          {/* Project (Optional) */}
          <div className="space-y-2">
            <Label>Project (Optional)</Label>
            <Popover open={projectOpen} onOpenChange={setProjectOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={projectOpen}
                  className="w-full justify-between"
                >
                  {selectedProject ? selectedProject.name : "Select project..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px] p-0">
                <Command>
                  <CommandInput placeholder="Search projects..." />
                  <CommandList>
                    <CommandEmpty>No project found.</CommandEmpty>
                    <CommandGroup>
                      {projects.map((project) => (
                        <CommandItem
                          key={project.id}
                          value={project.name}
                          onSelect={() => {
                            setProjectId(project.id);
                            setProjectOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              projectId === project.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {project.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {projectId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setProjectId(null)}
                className="text-xs"
              >
                Clear project
              </Button>
            )}
          </div>

          {/* Status & Dates */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as InvoiceStatus)}
              >
                <SelectTrigger id="invoice-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {INVOICE_STATUS_LABELS[s]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue-date">
                Issue Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="issue-date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due-date">
                Due Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLineItem}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Item
              </Button>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              {lineItems.map((item, index) => (
                <div key={index} className="space-y-2 rounded border bg-muted/30 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) =>
                          handleLineItemChange(index, "description", e.target.value)
                        }
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) =>
                            handleLineItemChange(index, "quantity", e.target.value)
                          }
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Unit Price"
                          value={item.unit_price}
                          onChange={(e) =>
                            handleLineItemChange(index, "unit_price", e.target.value)
                          }
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Amount"
                          value={item.amount.toFixed(2)}
                          disabled
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLineItem(index)}
                      disabled={lineItems.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tax & Totals */}
          <div className="space-y-2 rounded-md border p-3 bg-muted/20">
            <div className="flex items-center justify-between text-sm">
              <span>Subtotal:</span>
              <span className="font-medium">{currency} {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="tax-rate" className="text-sm">Tax Rate (%):</Label>
              <Input
                id="tax-rate"
                type="number"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="w-24"
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Tax Amount:</span>
              <span className="font-medium">{currency} {taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
              <span>Total:</span>
              <span>{currency} {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Currency */}
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="CAD">CAD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Terms */}
          <div className="space-y-2">
            <Label htmlFor="payment-terms">Payment Terms</Label>
            <Input
              id="payment-terms"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="Net 30"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="invoice-notes">Notes</Label>
            <Textarea
              id="invoice-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes or terms..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : invoice ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
