"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ContractSheet } from "@/components/contracts/ContractSheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Loader2,
  Plus,
  Calendar,
  DollarSign,
  User,
  FolderOpen,
} from "lucide-react";
import {
  Contract,
  CONTRACT_STATUS_LABELS,
  Contact,
  Project,
  contactDisplayName,
} from "@/types/database";
import { formatCurrency, formatDate } from "@/lib/format";
import { contractStatusClasses } from "@/lib/status";

export default function ContractsPage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
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
      const [contractsRes, contactsRes, projectsRes] = await Promise.all([
        fetch(`/api/contracts?workspaceId=${activeWorkspace.id}`),
        fetch(`/api/contacts?workspaceId=${activeWorkspace.id}`),
        fetch(`/api/projects?workspaceId=${activeWorkspace.id}`),
      ]);

      const [contractsData, contactsData, projectsData] = await Promise.all([
        contractsRes.json(),
        contactsRes.json(),
        projectsRes.json(),
      ]);

      setContracts(contractsData.contracts || []);
      setContacts(contactsData.contacts || []);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contracts</h1>
          <p className="text-muted-foreground">
            Manage contracts and service agreements
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Contract
        </Button>
      </div>

      {/* Empty State */}
      {contracts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No contracts yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Get started by creating your first contract
            </p>
            <Button onClick={() => setSheetOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Contract
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Contract Cards Grid */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {contracts.map((contract) => (
            <Link key={contract.id} href={`/contracts/${contract.id}`}>
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="line-clamp-1 text-base">
                        {contract.name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {contract.contract_number}
                      </p>
                    </div>
                    <Badge className={contractStatusClasses(contract.status)}>
                      {CONTRACT_STATUS_LABELS[contract.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {contract.contact && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {contactDisplayName(contract.contact)}
                      </span>
                    </div>
                  )}
                  {contract.project && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FolderOpen className="h-4 w-4 shrink-0" />
                      <span className="truncate">{contract.project.name}</span>
                    </div>
                  )}
                  {contract.value != null && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-4 w-4 shrink-0" />
                      <span className="font-medium">
                        {formatCurrency(contract.value, contract.currency)}
                      </span>
                    </div>
                  )}
                  {(contract.start_date || contract.end_date) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span className="text-xs">
                        {contract.start_date
                          ? formatDate(contract.start_date)
                          : "No start"}{" "}
                        -{" "}
                        {contract.end_date
                          ? formatDate(contract.end_date)
                          : "No end"}
                      </span>
                    </div>
                  )}
                  {contract.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {contract.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Contract Sheet */}
      <ContractSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        workspaceId={activeWorkspace.id}
        contacts={contacts}
        projects={projects}
        onSaved={fetchData}
      />
    </div>
  );
}
