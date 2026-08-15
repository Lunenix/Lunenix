"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ContractSheet } from "@/components/contracts/ContractSheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  FileText,
  FolderOpen,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import {
  Contract,
  CONTRACT_STATUS_LABELS,
  Contact,
  Project,
  contactDisplayName,
} from "@/types/database";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { contractStatusClasses } from "@/lib/status";

interface ContractDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ContractDetailPage({ params }: ContractDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();

  const [contract, setContract] = useState<Contract | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
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
      const [contractRes, contactsRes, projectsRes] = await Promise.all([
        fetch(`/api/contracts/${id}`),
        fetch(`/api/contacts?workspaceId=${activeWorkspace?.id}`),
        fetch(`/api/projects?workspaceId=${activeWorkspace?.id}`),
      ]);

      const [contractData, contactsData, projectsData] = await Promise.all([
        contractRes.json(),
        contactsRes.json(),
        projectsRes.json(),
      ]);

      setContract(contractData.contract);
      setContacts(contactsData.contacts || []);
      setProjects(projectsData.projects || []);
    } catch (error) {
      console.error("Error fetching contract:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!contract) return;
    if (
      !confirm(
        `Are you sure you want to delete contract "${contract.name}"? This action cannot be undone.`
      )
    )
      return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/contracts/${contract.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete contract");
      router.push("/contracts");
    } catch (error) {
      console.error("Error deleting contract:", error);
      alert("Failed to delete contract");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Contract not found</p>
        <Button asChild>
          <Link href="/contracts">Back to Contracts</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            asChild
          >
            <Link href="/contracts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Contracts
            </Link>
          </Button>
          <div className="flex items-start gap-3">
            <h1 className="text-3xl font-bold">{contract.name}</h1>
            <Badge className={contractStatusClasses(contract.status)}>
              {CONTRACT_STATUS_LABELS[contract.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {contract.contract_number}
          </p>
        </div>
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

      {/* Contract Details Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Details */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contract.contact && (
              <div className="flex items-start gap-3">
                <User className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Contact</p>
                  <p className="text-sm text-muted-foreground">
                    {contactDisplayName(contract.contact)}
                  </p>
                </div>
              </div>
            )}
            {contract.project && (
              <div className="flex items-start gap-3">
                <FolderOpen className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Project</p>
                  <Link
                    href={`/projects/${contract.project.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {contract.project.name}
                  </Link>
                </div>
              </div>
            )}
            {contract.value != null && (
              <div className="flex items-start gap-3">
                <DollarSign className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Value</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(contract.value, contract.currency)}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Duration</p>
                <p className="text-sm text-muted-foreground">
                  {contract.start_date
                    ? formatDate(contract.start_date)
                    : "No start date"}{" "}
                  -{" "}
                  {contract.end_date
                    ? formatDate(contract.end_date)
                    : "No end date"}
                </p>
              </div>
            </div>
            {contract.signed_at && (
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Signed</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(contract.signed_at)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Description */}
        {contract.description && (
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {contract.description}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Terms & Conditions */}
      {contract.terms && (
        <Card>
          <CardHeader>
            <CardTitle>Terms & Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {contract.terms}
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
              {formatDateTime(contract.created_at)}
            </div>
            <div>
              <span className="font-medium">Updated:</span>{" "}
              {formatDateTime(contract.updated_at)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Sheet */}
      <ContractSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        workspaceId={contract.workspace_id}
        contacts={contacts}
        projects={projects}
        contract={contract}
        onSaved={fetchData}
      />
    </div>
  );
}
