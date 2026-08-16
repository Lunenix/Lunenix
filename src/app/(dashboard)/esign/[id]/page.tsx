"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PdfPages, type PageSize } from "@/components/esign/PdfPages";
import { SignaturePad, type SignatureValue } from "@/components/esign/SignaturePad";
import { RichTextEditor } from "@/components/document/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  FileText,
  Loader2,
  MoreVertical,
  Pencil,
  PenLine,
  Type as TypeIcon,
  Calendar as CalendarIcon,
  Upload,
  User as UserIcon,
  Baseline,
  Trash2,
  Send,
  Save,
  CheckCircle2,
  Check,
  ChevronsUpDown,
  Copy,
  Sparkles,
  Download,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EsignDocument,
  EsignDocumentType,
  EsignField,
  EsignFieldType,
  EsignEvent,
  EsignSignature,
  ESIGN_FIELD_LABELS,
  ESIGN_STATUS_LABELS,
  ESIGN_TYPE_LABELS,
  AutomationWorkflow,
  Contact,
  Project,
  contactDisplayName,
} from "@/types/database";
import { esignStatusClasses } from "@/lib/status";
import { formatDateTime } from "@/lib/format";

interface LocalField extends Omit<EsignField, "id" | "document_id" | "created_at"> {
  localId: string;
}

const FIELD_META: Record<
  EsignFieldType,
  { icon: React.ComponentType<{ className?: string }>; w: number; h: number }
> = {
  signature: { icon: PenLine, w: 0.24, h: 0.06 },
  initials: { icon: Baseline, w: 0.1, h: 0.05 },
  date: { icon: CalendarIcon, w: 0.16, h: 0.035 },
  name: { icon: UserIcon, w: 0.24, h: 0.035 },
  text: { icon: TypeIcon, w: 0.24, h: 0.035 },
};

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export default function EsignEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();

  const [doc, setDoc] = useState<EsignDocument | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<LocalField[]>([]);
  const [, setPageSizes] = useState<PageSize[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [armedType, setArmedType] = useState<EsignFieldType | null>(null);
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [assignedWorkflowId, setAssignedWorkflowId] = useState("none");
  const [signerPickerOpen, setSignerPickerOpen] = useState(false);

  // Contract/business metadata (unified contracts section).
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [terms, setTerms] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sendUrl, setSendUrl] = useState<string | null>(null);
  const [countersigning, setCountersigning] = useState(false);

  // Document action dialogs.
  const [editOpen, setEditOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<EsignDocumentType>("contract");
  const [editContactId, setEditContactId] = useState("none");
  const [editProjectId, setEditProjectId] = useState("none");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Editable document state.
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [savingContent, setSavingContent] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/esign/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      const d: EsignDocument = data.document;
      setDoc(d);
      setFileUrl(data.fileUrl);
      setSignedUrl(data.signedUrl);
      setSignerName(d.signer_name || (d.contact ? contactDisplayName(d.contact) : ""));
      setSignerEmail(d.signer_email || d.contact?.email || "");
      setAssignedWorkflowId(d.assigned_workflow_id || "none");
      setValue(d.value != null ? String(d.value) : "");
      setCurrency(d.currency || "USD");
      setStartDate(d.start_date || "");
      setEndDate(d.end_date || "");
      setDescription(d.description || "");
      setTerms(d.terms || "");
      setEditedContent(d.content || "");
      setFields(
        (d.fields || []).map((f) => ({
          localId: uid(),
          page: f.page,
          field_type: f.field_type,
          pos_x: f.pos_x,
          pos_y: f.pos_y,
          width: f.width,
          height: f.height,
          assigned_to: f.assigned_to,
          required: f.required,
          placeholder: f.placeholder,
          value: f.value,
        }))
      );
      if (d.workspace_id) {
        const [wfRes, contactsRes, projectsRes] = await Promise.all([
          fetch(`/api/automation-workflows?workspaceId=${d.workspace_id}`),
          fetch(`/api/contacts?workspaceId=${d.workspace_id}`),
          fetch(`/api/projects?workspaceId=${d.workspace_id}`),
        ]);
        const [wfData, contactsData, projectsData] = await Promise.all([
          wfRes.json(),
          contactsRes.json(),
          projectsRes.json(),
        ]);
        setWorkflows(wfData.workflows || []);
        setContacts(contactsData.contacts || []);
        setProjects(projectsData.projects || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load document");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const isLocked =
    !!doc && ["signed", "countersigned", "void"].includes(doc.status);

  const placeField = (
    pageIndex: number,
    xNorm: number,
    yNorm: number
  ) => {
    if (!armedType) return;
    const meta = FIELD_META[armedType];
    const newField: LocalField = {
      localId: uid(),
      page: pageIndex,
      field_type: armedType,
      pos_x: Math.max(0, Math.min(1 - meta.w, xNorm - meta.w / 2)),
      pos_y: Math.max(0, Math.min(1 - meta.h, yNorm - meta.h / 2)),
      width: meta.w,
      height: meta.h,
      assigned_to: "client",
      required: true,
      placeholder: null,
      value: null,
    };
    setFields((f) => [...f, newField]);
    setSelectedId(newField.localId);
    setArmedType(null);
  };

  const updateField = (localId: string, patch: Partial<LocalField>) => {
    setFields((f) =>
      f.map((x) => (x.localId === localId ? { ...x, ...patch } : x))
    );
  };
  const deleteField = (localId: string) => {
    setFields((f) => f.filter((x) => x.localId !== localId));
    if (selectedId === localId) setSelectedId(null);
  };

  const autoFill = () => {
    if (!doc) return;
    const clientName = doc.contact ? contactDisplayName(doc.contact) : "";
    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    setFields((f) =>
      f.map((x) => {
        if (x.field_type === "name" && clientName)
          return { ...x, value: clientName };
        if (x.field_type === "date") return { ...x, value: today };
        return x;
      })
    );
    setNotice("Auto-filled name and date fields from the linked record.");
  };

  const saveFields = async (silent = false) => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        fields: fields.map((f) => ({
          page: f.page,
          field_type: f.field_type,
          pos_x: f.pos_x,
          pos_y: f.pos_y,
          width: f.width,
          height: f.height,
          assigned_to: f.assigned_to,
          required: f.required,
          placeholder: f.placeholder,
          value: f.value,
        })),
      };
      const res = await fetch(`/api/esign/${id}/fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      // Persist meta (signer, assigned workflow).
      await fetch(`/api/esign/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signer_name: signerName || null,
          signer_email: signerEmail || null,
          assigned_workflow_id:
            assignedWorkflowId === "none" ? null : assignedWorkflowId,
          value: value.trim() === "" ? null : Number(value),
          currency: currency || "USD",
          start_date: startDate || null,
          end_date: endDate || null,
          description: description.trim() || null,
          terms: terms.trim() || null,
        }),
      });
      if (!silent) setNotice("Saved.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const send = async () => {
    setError(null);
    setNotice(null);
    if (fields.length === 0) {
      setError("Add at least one field before sending.");
      return;
    }
    if (!signerEmail.trim()) {
      setError("Enter the signer's email before sending.");
      return;
    }
    setSending(true);
    const saved = await saveFields(true);
    if (!saved) {
      setSending(false);
      return;
    }
    try {
      const res = await fetch(`/api/esign/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signer_name: signerName || null,
          signer_email: signerEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setSendUrl(data.sign_url);
      setNotice(
        data.email_sent
          ? "Sent! The signer has been emailed a signing link."
          : "Signing link created (email could not be sent — copy the link below)."
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const saveContent = async () => {
    if (!doc || doc.content_type !== "editable_document") return;
    setSavingContent(true);
    setError(null);
    try {
      const res = await fetch(`/api/esign/${id}/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editedContent }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save content");
      }
      setNotice("Document content saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save content");
    } finally {
      setSavingContent(false);
    }
  };

  const generatePdf = async () => {
    if (!doc || !editedContent) return;
    setGeneratingPdf(true);
    setError(null);
    try {
      // First save the content.
      await saveContent();

      // Import jsPDF dynamically (client-side only).
      const { default: jsPDF } = await import("jspdf");

      // Create a temporary container for HTML rendering.
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.width = "210mm"; // A4 width
      container.style.padding = "20mm";
      container.innerHTML = editedContent;
      document.body.appendChild(container);

      // Generate PDF using jsPDF with html plugin.
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      await pdf.html(container, {
        callback: async (pdfDoc) => {
          // Convert to blob and upload.
          const pdfBlob = pdfDoc.output("blob");
          const formData = new FormData();
          formData.append("file", pdfBlob, `${doc.name}.pdf`);

          const res = await fetch(`/api/esign/${id}/replace-file`, {
            method: "PUT",
            body: formData,
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to generate PDF");
          }

          setNotice("PDF generated successfully. Reloading...");
          await load();
          setEditMode(false);
        },
        x: 0,
        y: 0,
        width: 210, // A4 width in mm
        windowWidth: 794, // ~210mm at 96dpi
      });

      // Clean up.
      document.body.removeChild(container);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!doc) {
    return (
      <div className="space-y-4">
        <Link href="/esign" className="text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="mr-1 inline h-4 w-4" /> Back
        </Link>
        <p className="text-destructive">{error || "Document not found."}</p>
      </div>
    );
  }

  const selected = fields.find((f) => f.localId === selectedId) || null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/esign">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{doc.name}</h1>
              <Badge
                variant="outline"
                className={`text-xs ${esignStatusClasses(doc.status)}`}
              >
                {ESIGN_STATUS_LABELS[doc.status]}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {doc.contract_number && (
                <span className="font-mono font-medium text-foreground">
                  {doc.contract_number}
                </span>
              )}
              {doc.project && <span>Project: {doc.project.name}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {doc.content_type === "editable_document" && !isLocked && (
            <>
              {editMode ? (
                <>
                  <Button variant="outline" onClick={saveContent} disabled={savingContent}>
                    {savingContent ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Content
                  </Button>
                  <Button onClick={generatePdf} disabled={generatingPdf}>
                    {generatingPdf ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="mr-2 h-4 w-4" />
                    )}
                    Generate PDF
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditMode(false)}
                    title="Preview mode"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setEditMode(true)}
                  title="Edit document content"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Document
                </Button>
              )}
            </>
          )}
          {!isLocked && !editMode && (
            <>
              <Button variant="outline" onClick={() => saveFields(false)} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
              <Button onClick={send} disabled={sending}>
                {sending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send for signing
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Document actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setEditName(doc.name);
                  setEditType(doc.type as EsignDocumentType);
                  setEditContactId(doc.contact_id || "none");
                  setEditProjectId(doc.project_id || "none");
                  setEditError(null);
                  setEditOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" /> Edit details
              </DropdownMenuItem>
              {!isLocked && (
                <DropdownMenuItem
                  onClick={() => {
                    setReplaceFile(null);
                    setReplaceError(null);
                    setReplaceOpen(true);
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" /> Replace PDF
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete document
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {(error || notice) && (
        <div
          className={`rounded-md p-3 text-sm ${
            error
              ? "bg-destructive/10 text-destructive"
              : "bg-green-500/10 text-green-500"
          }`}
        >
          {error || notice}
        </div>
      )}

      {sendUrl && (
        <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 p-3 text-sm">
          <span className="shrink-0 font-medium">Signing link:</span>
          <code className="min-w-0 flex-1 truncate">{sendUrl}</code>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(sendUrl);
              setNotice("Link copied to clipboard.");
            }}
          >
            <Copy className="mr-1 h-3.5 w-3.5" /> Copy
          </Button>
        </div>
      )}

      {isLocked ? (
        doc.status === "signed" &&
        (doc.fields || []).some((f) => f.assigned_to === "owner") &&
        countersigning ? (
          <CountersignView
            doc={doc}
            fileUrl={fileUrl}
            onCancel={() => setCountersigning(false)}
            onDone={async () => {
              setCountersigning(false);
              setNotice("Document countersigned and executed.");
              await load();
            }}
          />
        ) : (
          <SignedView
            doc={doc}
            signedUrl={signedUrl}
            fileUrl={fileUrl}
            canCountersign={
              doc.status === "signed" &&
              (doc.fields || []).some((f) => f.assigned_to === "owner")
            }
            onStartCountersign={() => setCountersigning(true)}
          />
        )
      ) : editMode && doc.content_type === "editable_document" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Edit Document Content</CardTitle>
            </CardHeader>
            <CardContent>
              <RichTextEditor
                content={editedContent}
                onChange={setEditedContent}
                editable={true}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Edit the document content above, then click <strong>Generate PDF</strong> to
                create a finalized PDF for signature field placement.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* PDF + fields */}
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            {armedType && (
              <div className="mb-2 rounded-md bg-primary/10 p-2 text-center text-xs text-primary">
                Click on the document to place a{" "}
                <strong>{ESIGN_FIELD_LABELS[armedType]}</strong> field.
              </div>
            )}
            {fileUrl ? (
              <PdfPages
                fileUrl={fileUrl}
                onReady={setPageSizes}
                onPageClick={(pageIndex, x, y) => placeField(pageIndex, x, y)}
                renderOverlay={(pageIndex, size) => (
                  <>
                    {fields
                      .filter((f) => f.page === pageIndex)
                      .map((f) => (
                        <DraggableField
                          key={f.localId}
                          field={f}
                          pageSize={size}
                          selected={selectedId === f.localId}
                          onSelect={() => setSelectedId(f.localId)}
                          onChange={(patch) => updateField(f.localId, patch)}
                          onDelete={() => deleteField(f.localId)}
                        />
                      ))}
                  </>
                )}
              />
            ) : (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Could not load the PDF preview.
              </p>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Add fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(FIELD_META) as EsignFieldType[]).map((t) => {
                    const Icon = FIELD_META[t].icon;
                    return (
                      <Button
                        key={t}
                        variant={armedType === t ? "default" : "outline"}
                        size="sm"
                        className="justify-start"
                        onClick={() => setArmedType(armedType === t ? null : t)}
                      >
                        <Icon className="mr-2 h-3.5 w-3.5" />
                        {ESIGN_FIELD_LABELS[t]}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Select a field type, then click on the document to place it.
                </p>
                {(doc.contact || doc.project) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={autoFill}
                  >
                    <Sparkles className="mr-2 h-3.5 w-3.5" /> Auto-fill from record
                  </Button>
                )}
              </CardContent>
            </Card>

            {selected && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    {ESIGN_FIELD_LABELS[selected.field_type]} field
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Assigned to</Label>
                    <Select
                      value={selected.assigned_to}
                      onValueChange={(v) =>
                        updateField(selected.localId, {
                          assigned_to: v as "client" | "owner",
                        })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Client (signer)</SelectItem>
                        <SelectItem value="owner">You (owner)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {["text", "name", "date"].includes(selected.field_type) && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Prefilled value (optional)
                      </Label>
                      <Input
                        className="h-8"
                        value={selected.value || ""}
                        onChange={(e) =>
                          updateField(selected.localId, {
                            value: e.target.value || null,
                          })
                        }
                        placeholder="Leave blank for signer to fill"
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={selected.required}
                      onCheckedChange={(c) =>
                        updateField(selected.localId, { required: !!c })
                      }
                    />
                    Required
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={() => deleteField(selected.localId)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove field
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Contract details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Value</Label>
                    <Input
                      className="h-8"
                      type="number"
                      step="0.01"
                      min="0"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="h-8">
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
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Start date</Label>
                    <Input
                      className="h-8"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">End date</Label>
                    <Input
                      className="h-8"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short summary of what this contract covers"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Terms</Label>
                  <Textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    placeholder="Key terms, scope, or notes"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Signer &amp; workflow</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Signer name</Label>
                  {contacts.length > 0 && (
                    <Popover open={signerPickerOpen} onOpenChange={setSignerPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          size="sm"
                          className="h-8 w-full justify-between font-normal"
                        >
                          <span className="truncate text-muted-foreground">
                            Select from contacts…
                          </span>
                          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder="Search contacts…" />
                          <CommandList>
                            <CommandEmpty>No contacts found.</CommandEmpty>
                            <CommandGroup>
                              {contacts.map((c) => {
                                const name = contactDisplayName(c);
                                return (
                                  <CommandItem
                                    key={c.id}
                                    value={name + " " + (c.email || "") + " " + c.id}
                                    onSelect={() => {
                                      setSignerName(name);
                                      if (c.email) setSignerEmail(c.email);
                                      setSignerPickerOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        signerName === name
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    <span className="flex flex-col">
                                      <span>{name}</span>
                                      {c.email && (
                                        <span className="text-xs text-muted-foreground">
                                          {c.email}
                                        </span>
                                      )}
                                    </span>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                  <Input
                    className="h-8"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Type a name or select a contact above"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Signer email</Label>
                  <Input
                    className="h-8"
                    type="email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    placeholder="signer@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Start workflow on signing</Label>
                  <Select
                    value={assignedWorkflowId}
                    onValueChange={setAssignedWorkflowId}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {workflows.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The <code>contract_signed</code> trigger also fires
                    automatically.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ─────────── Edit details dialog ─────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit document details</DialogTitle>
            <DialogDescription>
              Update the name, type, or linked client and project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v as EsignDocumentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ESIGN_TYPE_LABELS) as EsignDocumentType[]).map((t) => (
                    <SelectItem key={t} value={t}>{ESIGN_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={editContactId} onValueChange={setEditContactId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{contactDisplayName(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={editProjectId} onValueChange={setEditProjectId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
              Cancel
            </Button>
            <Button
              disabled={editSaving}
              onClick={async () => {
                if (!editName.trim()) { setEditError("Name is required."); return; }
                setEditSaving(true);
                setEditError(null);
                try {
                  const res = await fetch(`/api/esign/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: editName.trim(),
                      type: editType,
                      contact_id: editContactId === "none" ? null : editContactId,
                      project_id: editProjectId === "none" ? null : editProjectId,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Failed to update");
                  setEditOpen(false);
                  await load();
                } catch (e) {
                  setEditError(e instanceof Error ? e.message : "Failed to update");
                } finally {
                  setEditSaving(false);
                }
              }}
            >
              {editSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────── Replace PDF dialog ─────────── */}
      <Dialog open={replaceOpen} onOpenChange={setReplaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace PDF</DialogTitle>
            <DialogDescription>
              Upload a new PDF to replace the current document.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                All existing signature field placements will be cleared. You will need to re-add
                them on the new document. The document will return to <strong>draft</strong> status.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="replace-pdf">New PDF file</Label>
              <Input
                id="replace-pdf"
                type="file"
                accept="application/pdf"
                onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
              />
            </div>
            {replaceError && <p className="text-sm text-destructive">{replaceError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceOpen(false)} disabled={replacing}>
              Cancel
            </Button>
            <Button
              disabled={replacing || !replaceFile}
              onClick={async () => {
                if (!replaceFile) { setReplaceError("Please select a PDF file."); return; }
                setReplacing(true);
                setReplaceError(null);
                try {
                  const fd = new FormData();
                  fd.append("file", replaceFile);
                  const res = await fetch(`/api/esign/${id}/replace-file`, {
                    method: "PUT",
                    body: fd,
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Failed to replace PDF");
                  setReplaceOpen(false);
                  setFields([]);
                  await load();
                } catch (e) {
                  setReplaceError(e instanceof Error ? e.message : "Failed to replace PDF");
                } finally {
                  setReplacing(false);
                }
              }}
            >
              {replacing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Replace PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────── Delete confirmation dialog ─────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong>{doc?.name}</strong>? This will remove the document, all
              field placements, signatures, and the stored PDF. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                setDeleteError(null);
                try {
                  const res = await fetch(`/api/esign/${id}`, { method: "DELETE" });
                  if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || "Failed to delete");
                  }
                  router.push("/esign");
                } catch (e) {
                  setDeleteError(e instanceof Error ? e.message : "Failed to delete");
                  setDeleting(false);
                }
              }}
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Draggable / resizable field box ---------------- */

function DraggableField({
  field,
  pageSize,
  selected,
  onSelect,
  onChange,
  onDelete,
}: {
  field: LocalField;
  pageSize: PageSize;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<LocalField>) => void;
  onDelete: () => void;
}) {
  const dragState = useRef<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const onPointerDown = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    dragState.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: field.pos_x,
      origY: field.pos_y,
      origW: field.width,
      origH: field.height,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = dragState.current;
    if (!st) return;
    const dx = (e.clientX - st.startX) / pageSize.width;
    const dy = (e.clientY - st.startY) / pageSize.height;
    if (st.mode === "move") {
      onChange({
        pos_x: Math.max(0, Math.min(1 - field.width, st.origX + dx)),
        pos_y: Math.max(0, Math.min(1 - field.height, st.origY + dy)),
      });
    } else {
      onChange({
        width: Math.max(0.04, Math.min(1 - field.pos_x, st.origW + dx)),
        height: Math.max(0.02, Math.min(1 - field.pos_y, st.origH + dy)),
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragState.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const Icon = FIELD_META[field.field_type].icon;

  return (
    <div
      className={`absolute cursor-move rounded-sm border-2 text-[10px] ${field.assigned_to === "owner" ? "border-dashed" : ""}`}
      style={{
        left: `${field.pos_x * 100}%`,
        top: `${field.pos_y * 100}%`,
        width: `${field.width * 100}%`,
        height: `${field.height * 100}%`,
        borderColor: '#000000',
        backgroundColor: selected ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.05)',
        color: '#000000',
      }}
      onPointerDown={onPointerDown("move")}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="pointer-events-none flex h-full w-full items-center justify-center gap-1 overflow-hidden px-1">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">
          {field.value || ESIGN_FIELD_LABELS[field.field_type]}
        </span>
      </div>
      {selected && (
        <>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDelete();
            }}
            className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white"
            aria-label="Remove field"
          >
            ×
          </button>
          <div
            onPointerDown={onPointerDown("resize")}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="absolute -bottom-1 -right-1 h-3 w-3 cursor-se-resize rounded-sm border-2 bg-white"
            style={{ borderColor: '#9333ea' }}
          />
        </>
      )}
    </div>
  );
}

/* ---------------- Signed (read-only) view ---------------- */

function SignedView({
  doc,
  signedUrl,
  fileUrl,
  canCountersign,
  onStartCountersign,
}: {
  doc: EsignDocument;
  signedUrl: string | null;
  fileUrl: string | null;
  canCountersign?: boolean;
  onStartCountersign?: () => void;
}) {
  const url = signedUrl || fileUrl;
  const events = (doc.events || []) as EsignEvent[];
  const signatures = (doc.signatures || []) as EsignSignature[];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        {url ? (
          <PdfPages fileUrl={url} />
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Document unavailable.
          </p>
        )}
      </div>
      <div className="space-y-4">
        {canCountersign && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <PenLine className="h-4 w-4 text-primary" /> Awaiting your
                countersignature
              </div>
              <p className="text-xs text-muted-foreground">
                The client has signed. Complete the owner fields to fully execute
                this document.
              </p>
              <Button className="w-full" onClick={onStartCountersign}>
                <PenLine className="mr-2 h-4 w-4" /> Countersign now
              </Button>
            </CardContent>
          </Card>
        )}
        {signedUrl && (
          <Button asChild className="w-full">
            <a href={signedUrl} target="_blank" rel="noreferrer">
              <Download className="mr-2 h-4 w-4" /> Download signed PDF
            </a>
          </Button>
        )}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-green-500" /> Audit trail
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {signatures.map((s) => (
              <div key={s.id} className="rounded-md bg-muted/40 p-2">
                <p className="font-medium">{s.signer_name}</p>
                {s.signer_email && (
                  <p className="text-muted-foreground">{s.signer_email}</p>
                )}
                <p className="text-muted-foreground">
                  Signed {formatDateTime(s.signed_at)}
                </p>
                {s.ip_address && (
                  <p className="text-muted-foreground">IP {s.ip_address}</p>
                )}
              </div>
            ))}
            <div className="space-y-1.5">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span className="capitalize">{ev.event_type}</span>
                  <span className="ml-auto text-muted-foreground">
                    {formatDateTime(ev.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


/* ---------------- Countersign (owner) view ---------------- */

function CountersignView({
  doc,
  fileUrl,
  onCancel,
  onDone,
}: {
  doc: EsignDocument;
  fileUrl: string | null;
  onCancel: () => void;
  onDone: () => void | Promise<void>;
}) {
  const fields = (doc.fields || []) as EsignField[];
  const ownerFields = fields.filter((f) => f.assigned_to === "owner");
  const hasOwnerSig = ownerFields.some(
    (f) => f.field_type === "signature" || f.field_type === "initials"
  );

  const [values, setValues] = useState<Record<string, string>>({});
  const [signature, setSignature] = useState<SignatureValue | null>(null);
  const [signerName, setSignerName] = useState("");
  const [sigDialogOpen, setSigDialogOpen] = useState(false);
  const [draftSig, setDraftSig] = useState<SignatureValue | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setValue = (id: string, v: string) =>
    setValues((prev) => ({ ...prev, [id]: v }));

  const validate = (): string | null => {
    if (hasOwnerSig && !signerName.trim())
      return "Please enter your name to countersign.";
    for (const f of ownerFields) {
      if (!f.required) continue;
      if (f.field_type === "signature" || f.field_type === "initials") {
        if (!signature) return "Please add your signature.";
      } else if (f.field_type === "date" || f.field_type === "name") {
        // Auto-filled server-side if empty.
      } else if (!values[f.id]?.trim()) {
        return "Please complete all required fields.";
      }
    }
    if (hasOwnerSig && !signature) return "Please add your signature.";
    return null;
  };

  const submit = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/esign/${doc.id}/countersign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_values: values,
          signature,
          signer_name: signerName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to countersign");
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to countersign");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
        <div>
          <p className="text-sm font-medium">Countersign this document</p>
          <p className="text-xs text-muted-foreground">
            Complete the owner fields highlighted on the document, then finish to
            fully execute it.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PenLine className="mr-2 h-4 w-4" />
            )}
            Finish &amp; Countersign
          </Button>
        </div>
      </div>

      {hasOwnerSig && (
        <div className="grid gap-3 rounded-lg border bg-background p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Your name</Label>
            <Input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant={signature ? "outline" : "default"}
              onClick={() => {
                setDraftSig(signature);
                setSigDialogOpen(true);
              }}
            >
              <PenLine className="mr-2 h-4 w-4" />
              {signature ? "Change signature" : "Adopt your signature"}
            </Button>
            {signature && (
              <span className="ml-3 text-xs text-green-600">Signature ready</span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-lg border bg-muted/20 p-3">
        {fileUrl ? (
          <PdfPages
            fileUrl={fileUrl}
            renderOverlay={(pageIndex) => (
              <>
                {fields
                  .filter((f) => f.page === pageIndex)
                  .map((f) => (
                    <CountersignFieldBox
                      key={f.id}
                      field={f}
                      value={values[f.id] || ""}
                      signature={signature}
                      signerName={signerName}
                      onChangeValue={(v) => setValue(f.id, v)}
                      onRequestSignature={() => {
                        setDraftSig(signature);
                        setSigDialogOpen(true);
                      }}
                    />
                  ))}
              </>
            )}
          />
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Could not load the document.
          </p>
        )}
      </div>

      <Dialog open={sigDialogOpen} onOpenChange={setSigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adopt your signature</DialogTitle>
          </DialogHeader>
          <SignaturePad defaultName={signerName} onChange={(v) => setDraftSig(v)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSigDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setSignature(draftSig);
                setSigDialogOpen(false);
              }}
              disabled={!draftSig}
            >
              Adopt &amp; Sign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CountersignFieldBox({
  field,
  value,
  signature,
  signerName,
  onChangeValue,
  onRequestSignature,
}: {
  field: EsignField;
  value: string;
  signature: SignatureValue | null;
  signerName: string;
  onChangeValue: (v: string) => void;
  onRequestSignature: () => void;
}) {
  const isOwner = field.assigned_to === "owner";
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${field.pos_x * 100}%`,
    top: `${field.pos_y * 100}%`,
    width: `${field.width * 100}%`,
    height: `${field.height * 100}%`,
  };
  const isSig =
    field.field_type === "signature" || field.field_type === "initials";

  // Client fields — already completed, show read-only.
  if (!isOwner) {
    return (
      <div
        style={style}
        className="flex items-center justify-center overflow-hidden rounded-sm border border-green-500/40 bg-green-500/5 px-1 text-[10px] text-green-700"
        title="Signed by client"
      >
        {isSig ? (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Signed
          </span>
        ) : (
          <span className="truncate">{field.value || "—"}</span>
        )}
      </div>
    );
  }

  // Owner signature / initials.
  if (isSig) {
    const showTyped = signature?.type === "typed";
    const showDrawn = signature?.type === "drawn";
    const buttonStyle = {
      ...style,
      borderColor: signature ? 'rgba(34, 197, 94, 0.6)' : '#000000',
      backgroundColor: signature ? 'rgba(34, 197, 94, 0.05)' : 'rgba(0, 0, 0, 0.1)',
    };
    return (
      <button
        type="button"
        style={buttonStyle}
        onClick={onRequestSignature}
        className={`flex items-center justify-center overflow-hidden rounded-sm border-2 ${signature ? '' : 'animate-pulse'}`}
      >
        {showDrawn ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signature!.data}
            alt="signature"
            className="max-h-full max-w-full object-contain"
          />
        ) : showTyped ? (
          <span
            className="truncate px-1"
            style={{
              fontFamily: "'Brush Script MT','Segoe Script',cursive",
              fontSize: "min(2vw,20px)",
              color: '#000000',
            }}
          >
            {field.field_type === "initials"
              ? (signerName || signature!.data)
                  .split(/\s+/)
                  .map((p) => p[0]?.toUpperCase() || "")
                  .join("")
              : signature!.data}
          </span>
        ) : (
          <span className="text-[9px] font-medium" style={{ color: '#000000' }}>
            {field.field_type === "initials" ? "Initial" : "Sign"}
          </span>
        )}
      </button>
    );
  }

  // Owner text / name / date fillable inputs.
  const inputStyle = {
    ...style,
    borderColor: '#000000',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    color: '#000000',
  };
  return (
    <input
      style={inputStyle}
      value={value}
      onChange={(e) => onChangeValue(e.target.value)}
      placeholder={
        field.field_type === "date"
          ? "Date (auto)"
          : field.field_type === "name"
          ? "Full name (auto)"
          : field.placeholder || "Enter text"
      }
      className="rounded-sm border-2 px-1 text-[11px] outline-none focus:bg-white"
      onFocus={(e) => e.target.style.borderColor = '#000000'}
    />
  );
}
