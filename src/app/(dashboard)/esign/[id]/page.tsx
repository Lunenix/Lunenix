"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { PdfPages, type PageSize } from "@/components/esign/PdfPages";
import { SignaturePad, type SignatureValue } from "@/components/esign/SignaturePad";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  PenLine,
  Type as TypeIcon,
  Calendar as CalendarIcon,
  User as UserIcon,
  Baseline,
  Trash2,
  Send,
  Save,
  CheckCircle2,
  Copy,
  Sparkles,
  Download,
  ShieldCheck,
} from "lucide-react";
import {
  EsignDocument,
  EsignField,
  EsignFieldType,
  EsignEvent,
  EsignSignature,
  ESIGN_FIELD_LABELS,
  ESIGN_STATUS_LABELS,
  AutomationWorkflow,
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
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [doc, setDoc] = useState<EsignDocument | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<LocalField[]>([]);
  const [, setPageSizes] = useState<PageSize[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [armedType, setArmedType] = useState<EsignFieldType | null>(null);
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);

  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [assignedWorkflowId, setAssignedWorkflowId] = useState("none");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sendUrl, setSendUrl] = useState<string | null>(null);
  const [countersigning, setCountersigning] = useState(false);

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
        const wfRes = await fetch(
          `/api/automation-workflows?workspaceId=${d.workspace_id}`
        );
        const wfData = await wfRes.json();
        setWorkflows(wfData.workflows || []);
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
            {doc.project && (
              <p className="text-xs text-muted-foreground">
                Project: {doc.project.name}
              </p>
            )}
          </div>
        </div>
        {!isLocked && (
          <div className="flex gap-2">
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
          </div>
        )}
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
                <CardTitle className="text-sm">Signer &amp; workflow</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Signer name</Label>
                  <Input
                    className="h-8"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
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
      className={`absolute cursor-move rounded-sm border-2 text-[10px] ${
        selected
          ? "border-primary bg-primary/15"
          : "border-primary/50 bg-primary/10"
      } ${field.assigned_to === "owner" ? "border-dashed" : ""}`}
      style={{
        left: `${field.pos_x * 100}%`,
        top: `${field.pos_y * 100}%`,
        width: `${field.width * 100}%`,
        height: `${field.height * 100}%`,
      }}
      onPointerDown={onPointerDown("move")}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="pointer-events-none flex h-full w-full items-center justify-center gap-1 overflow-hidden px-1 text-primary">
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
            className="absolute -bottom-1 -right-1 h-3 w-3 cursor-se-resize rounded-sm border border-primary bg-white"
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
    return (
      <button
        type="button"
        style={style}
        onClick={onRequestSignature}
        className={`flex items-center justify-center overflow-hidden rounded-sm border-2 ${
          signature
            ? "border-green-500/60 bg-green-500/5"
            : "border-primary bg-primary/10 animate-pulse"
        }`}
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
            className="truncate px-1 text-[#12123a]"
            style={{
              fontFamily: "'Brush Script MT','Segoe Script',cursive",
              fontSize: "min(2vw,20px)",
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
          <span className="text-[9px] font-medium text-primary">
            {field.field_type === "initials" ? "Initial" : "Sign"}
          </span>
        )}
      </button>
    );
  }

  // Owner text / name / date fillable inputs.
  return (
    <input
      style={style}
      value={value}
      onChange={(e) => onChangeValue(e.target.value)}
      placeholder={
        field.field_type === "date"
          ? "Date (auto)"
          : field.field_type === "name"
          ? "Full name (auto)"
          : field.placeholder || "Enter text"
      }
      className="rounded-sm border-2 border-primary/60 bg-primary/5 px-1 text-[11px] outline-none focus:border-primary focus:bg-white"
    />
  );
}
