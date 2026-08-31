"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSignature,
  Loader2,
  Plus,
  Upload,
  User,
  FolderOpen,
  ExternalLink,
  BellRing,
  Copy,
} from "lucide-react";
import {
  EsignDocument,
  EsignDocumentType,
  ESIGN_STATUS_LABELS,
  ESIGN_TYPE_LABELS,
  Contact,
  Project,
  contactDisplayName,
} from "@/types/database";
import { formatDateTime, formatCurrency } from "@/lib/format";
import { esignStatusClasses } from "@/lib/status";

export default function EsignPage() {
  const router = useRouter();
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const [documents, setDocuments] = useState<EsignDocument[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [cloneSource, setCloneSource] = useState<EsignDocument | null>(null);

  const remind = async (doc: EsignDocument) => {
    setRemindingId(doc.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/esign/${doc.id}/remind`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reminder");
      setNotice(`Reminder sent to ${doc.signer_email}.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Failed to send reminder");
    } finally {
      setRemindingId(null);
    }
  };

  const fetchData = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const [docsRes, contactsRes, projectsRes] = await Promise.all([
        fetch(`/api/esign?workspaceId=${activeWorkspace.id}`),
        fetch(`/api/contacts?workspaceId=${activeWorkspace.id}`),
        fetch(`/api/projects?workspaceId=${activeWorkspace.id}`),
      ]);
      const [docsData, contactsData, projectsData] = await Promise.all([
        docsRes.json(),
        contactsRes.json(),
        projectsRes.json(),
      ]);
      setDocuments(docsData.documents || []);
      setContacts(contactsData.contacts || []);
      setProjects(projectsData.projects || []);
    } catch (e) {
      console.error("Error loading e-sign data:", e);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (activeWorkspace?.id) fetchData();
  }, [activeWorkspace?.id, fetchData]);

  if (workspaceLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contracts</h1>
          <p className="text-sm text-muted-foreground">
            Create a contract, place signature fields, and send it out for
            e-signature — all in one place.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Document
        </Button>
      </div>

      {notice && (
        <div className="rounded-md bg-primary/10 p-3 text-sm text-primary">
          {notice}
        </div>
      )}

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <FileSignature className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No documents yet</p>
              <p className="text-sm text-muted-foreground">
                Upload a PDF to start collecting signatures.
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Upload a document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="transition-colors hover:bg-accent/40">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileSignature className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{doc.name}</span>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {ESIGN_TYPE_LABELS[doc.type as EsignDocumentType]}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-xs ${esignStatusClasses(doc.status)}`}
                    >
                      {ESIGN_STATUS_LABELS[doc.status]}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {doc.contract_number && (
                      <span className="font-mono font-medium text-foreground">
                        {doc.contract_number}
                      </span>
                    )}
                    {doc.contact && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {contactDisplayName(doc.contact)}
                      </span>
                    )}
                    {doc.project && (
                      <span className="flex items-center gap-1">
                        <FolderOpen className="h-3 w-3" />
                        {doc.project.name}
                      </span>
                    )}
                    {doc.value != null && (
                      <span className="font-medium text-foreground">
                        {formatCurrency(doc.value, doc.currency || "USD")}
                      </span>
                    )}
                    {doc.signer_email && <span>Signer: {doc.signer_email}</span>}
                    <span>Created {formatDateTime(doc.created_at)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {["sent", "viewed"].includes(doc.status) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => remind(doc)}
                      disabled={remindingId === doc.id}
                      title="Send a signing reminder to the signer"
                    >
                      {remindingId === doc.id ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <BellRing className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Remind
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCloneSource(doc)}
                    title="Clone into a new sub-agreement draft"
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Clone
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/esign/${doc.id}`}>
                      {["signed", "countersigned", "void"].includes(doc.status)
                        ? "View"
                        : "Open"}
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workspaceId={activeWorkspace?.id || ""}
        contacts={contacts}
        projects={projects}
        onCreated={(id) => router.push(`/esign/${id}`)}
      />

      <CloneDialog
        source={cloneSource}
        onOpenChange={(v) => {
          if (!v) setCloneSource(null);
        }}
        onCloned={(id) => router.push(`/esign/${id}`)}
      />
    </div>
  );
}

function CloneDialog({
  source,
  onOpenChange,
  onCloned,
}: {
  source: EsignDocument | null;
  onOpenChange: (v: boolean) => void;
  onCloned: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<EsignDocumentType>("sub_agreement");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (source) {
      setName(`${source.name} (Sub-Agreement)`);
      setType("sub_agreement");
      setError(null);
    }
  }, [source]);

  const handleClone = async () => {
    if (!source || !name.trim()) {
      setError("A name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/esign/${source.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to clone document");
      onOpenChange(false);
      onCloned(data.document.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!source} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clone document</DialogTitle>
          <DialogDescription>
            Creates a new draft with the same PDF and field placements. Field
            values are reset so you can send it to a new signer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clonename">New document name</Label>
            <Input
              id="clonename"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as EsignDocumentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sub_agreement">Sub-Agreement</SelectItem>
                <SelectItem value="contract">Contract (primary)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleClone} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cloning…
              </>
            ) : (
              "Create clone"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewDocumentDialog({
  open,
  onOpenChange,
  workspaceId,
  contacts,
  projects,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  contacts: Contact[];
  projects: Project[];
  onCreated: (id: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<EsignDocumentType>("contract");
  const [contactId, setContactId] = useState<string>("none");
  const [projectId, setProjectId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setName("");
    setType("contract");
    setContactId("none");
    setProjectId("none");
    setError(null);
  };

  const handleSubmit = async () => {
    if (!file || !name.trim()) {
      setError("A PDF file and a name are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name.trim());
      fd.append("type", type);
      fd.append("workspace_id", workspaceId);
      if (contactId !== "none") fd.append("contact_id", contactId);
      if (projectId !== "none") fd.append("project_id", projectId);

      const res = await fetch("/api/esign", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create document");
      reset();
      onOpenChange(false);
      onCreated(data.document.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New signature document</DialogTitle>
          <DialogDescription>
            Upload a PDF. You&apos;ll place signature fields on the next screen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pdf">PDF or Word document</Label>
            <Input
              id="pdf"
              type="file"
              accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setFile(f);
                if (f && !name) setName(f.name.replace(/\.(pdf|docx)$/i, ""));
              }}
            />
            <p className="text-xs text-muted-foreground">
              Word documents (.docx) will be converted to editable format.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="docname">Document name</Label>
            <Input
              id="docname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Master Services Agreement"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as EsignDocumentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Contract (primary)</SelectItem>
                  <SelectItem value="sub_agreement">Sub-Agreement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Client (optional)</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {contactDisplayName(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Project (optional)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Linking a client or project lets fields auto-fill from that record.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
