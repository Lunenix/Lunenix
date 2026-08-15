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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Contract,
  ContractStatus,
  CONTRACT_STATUS_LABELS,
  Contact,
  contactDisplayName,
  Project,
} from "@/types/database";

interface ContractSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  contacts: Contact[];
  projects: Project[];
  contract?: Contract | null;
  onSaved: () => void;
}

export function ContractSheet({
  open,
  onOpenChange,
  workspaceId,
  contacts,
  projects,
  contract,
  onSaved,
}: ContractSheetProps) {
  const [contractNumber, setContractNumber] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ContractStatus>("draft");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [terms, setTerms] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (contract) {
      setContractNumber(contract.contract_number || "");
      setName(contract.name || "");
      setDescription(contract.description || "");
      setStatus(contract.status);
      setStartDate(contract.start_date || "");
      setEndDate(contract.end_date || "");
      setValue(contract.value?.toString() || "");
      setCurrency(contract.currency || "USD");
      setTerms(contract.terms || "");
      setContactId(contract.contact_id || null);
      setProjectId(contract.project_id || null);
    } else {
      // Reset for new contract
      setContractNumber("");
      setName("");
      setDescription("");
      setStatus("draft");
      setStartDate("");
      setEndDate("");
      setValue("");
      setCurrency("USD");
      setTerms("");
      setContactId(null);
      setProjectId(null);
    }
  }, [contract, open]);

  const handleSave = async () => {
    if (!contractNumber.trim() || !name.trim()) {
      alert("Contract number and name are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        workspace_id: workspaceId,
        contract_number: contractNumber.trim(),
        name: name.trim(),
        description: description.trim() || null,
        status,
        start_date: startDate || null,
        end_date: endDate || null,
        value: value ? parseFloat(value) : null,
        currency,
        terms: terms.trim() || null,
        contact_id: contactId,
        project_id: projectId,
      };

      const url = contract
        ? `/api/contracts/${contract.id}`
        : "/api/contracts";
      const method = contract ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save contract");

      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving contract:", error);
      alert("Failed to save contract. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const selectedContact = contacts.find((c) => c.id === contactId);
  const selectedProject = projects.find((p) => p.id === projectId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[540px]">
        <SheetHeader>
          <SheetTitle>
            {contract ? "Edit Contract" : "New Contract"}
          </SheetTitle>
          <SheetDescription>
            {contract
              ? "Update contract details"
              : "Create a new contract for your workspace"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Contract Number */}
          <div className="space-y-2">
            <Label htmlFor="contract-number">
              Contract Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contract-number"
              value={contractNumber}
              onChange={(e) => setContractNumber(e.target.value)}
              placeholder="CON-001"
            />
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="contract-name">
              Contract Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contract-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Service Agreement 2024"
            />
          </div>

          {/* Contact */}
          <div className="space-y-2">
            <Label>Contact</Label>
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
              <PopoverContent className="w-[400px] p-0">
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
            {contactId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setContactId(null)}
                className="text-xs"
              >
                Clear contact
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
              <PopoverContent className="w-[400px] p-0">
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

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="contract-status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ContractStatus)}>
              <SelectTrigger id="contract-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CONTRACT_STATUS_LABELS) as ContractStatus[]).map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {CONTRACT_STATUS_LABELS[s]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Value & Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contract-value">Value</Label>
              <Input
                id="contract-value"
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0.00"
              />
            </div>
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
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="contract-description">Description</Label>
            <Textarea
              id="contract-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the contract..."
              rows={3}
            />
          </div>

          {/* Terms */}
          <div className="space-y-2">
            <Label htmlFor="contract-terms">Terms & Conditions</Label>
            <Textarea
              id="contract-terms"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Enter contract terms and conditions..."
              rows={4}
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
              {saving ? "Saving..." : contract ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
