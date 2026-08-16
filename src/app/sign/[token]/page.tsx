"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { PdfPages } from "@/components/esign/PdfPages";
import { SignaturePad, type SignatureValue } from "@/components/esign/SignaturePad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle2, PenLine, Download } from "lucide-react";
import type { EsignField } from "@/types/database";

interface SignDoc {
  id: string;
  name: string;
  type: string;
  status: string;
  page_count: number;
  signer_name: string | null;
  signer_email: string | null;
}

export default function SignPage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;

  const [doc, setDoc] = useState<SignDoc | null>(null);
  const [fields, setFields] = useState<EsignField[]>([]);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [alreadySigned, setAlreadySigned] = useState(false);

  const [values, setValues] = useState<Record<string, string>>({});
  const [signature, setSignature] = useState<SignatureValue | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [sigDialogOpen, setSigDialogOpen] = useState(false);
  const [draftSig, setDraftSig] = useState<SignatureValue | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/sign/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Document not found");
        setDoc(data.document);
        setFields(data.fields || []);
        setFileUrl(data.fileUrl);
        setSignedUrl(data.signedUrl);
        setAlreadySigned(!!data.alreadySigned);
        setSignerName(data.document.signer_name || "");
        setSignerEmail(data.document.signer_email || "");
        const initial: Record<string, string> = {};
        (data.fields || []).forEach((f: EsignField) => {
          if (f.value) initial[f.id] = f.value;
        });
        setValues(initial);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load document");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const clientFields = useMemo(
    () => fields.filter((f) => f.assigned_to === "client"),
    [fields]
  );
  const hasSignatureField = clientFields.some(
    (f) => f.field_type === "signature" || f.field_type === "initials"
  );

  const setValue = (id: string, v: string) =>
    setValues((prev) => ({ ...prev, [id]: v }));

  const validate = (): string | null => {
    if (!signerName.trim()) return "Please enter your full name.";
    for (const f of clientFields) {
      if (!f.required) continue;
      if (f.field_type === "signature" || f.field_type === "initials") {
        if (!signature) return "Please add your signature.";
      } else if (f.field_type === "date" || f.field_type === "name") {
        // Auto-filled server-side if empty; not blocking.
      } else if (!values[f.id]?.trim()) {
        return "Please complete all required fields.";
      }
    }
    if (hasSignatureField && !signature) return "Please add your signature.";
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
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_values: values,
          signature,
          signer_name: signerName,
          signer_email: signerEmail || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !doc) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-lg font-medium">Unable to open document</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (done || alreadySigned) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <h1 className="mt-4 text-xl font-semibold">
            {done ? "Thank you — your document is signed" : "This document is signed"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {done
              ? "A signed copy has been emailed to you for your records."
              : "This document has already been completed."}
          </p>
          {signedUrl && (
            <Button asChild className="mt-4">
              <a href={signedUrl} target="_blank" rel="noreferrer">
                <Download className="mr-2 h-4 w-4" /> Download signed PDF
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Lunenix"
            width={28}
            height={28}
            className="h-7 w-7 rounded-full object-contain"
          />
          <div className="leading-tight">
            <p className="text-sm font-semibold">{doc?.name}</p>
            <p className="text-xs text-muted-foreground">
              Please review and sign
            </p>
          </div>
        </div>
        <Button onClick={submit} disabled={submitting} size="sm">
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PenLine className="mr-2 h-4 w-4" />
          )}
          Finish &amp; Sign
        </Button>
      </header>

      <div className="mx-auto max-w-5xl px-3 py-4">
        {/* Signer identity */}
        <div className="mb-4 grid gap-3 rounded-lg border bg-background p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sname" className="text-xs">
              Your full name
            </Label>
            <Input
              id="sname"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="semail" className="text-xs">
              Your email (for your signed copy)
            </Label>
            <Input
              id="semail"
              type="email"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>
          {hasSignatureField && (
            <div className="sm:col-span-2">
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
                <span className="ml-3 text-xs text-green-600">
                  Signature ready — it will be applied to all signature fields.
                </span>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Document with fillable fields */}
        <div className="rounded-lg border bg-muted/20 p-3">
          {fileUrl ? (
            <PdfPages
              fileUrl={fileUrl}
              renderOverlay={(pageIndex) => (
                <>
                  {fields
                    .filter((f) => f.page === pageIndex)
                    .map((f) => (
                      <SignFieldBox
                        key={f.id}
                        field={f}
                        value={values[f.id] || ""}
                        signature={signature}
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
      </div>

      {/* Signature dialog */}
      <Dialog open={sigDialogOpen} onOpenChange={setSigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adopt your signature</DialogTitle>
          </DialogHeader>
          <SignaturePad
            defaultName={signerName}
            onChange={(v) => setDraftSig(v)}
          />
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

function SignFieldBox({
  field,
  value,
  signature,
  onChangeValue,
  onRequestSignature,
}: {
  field: EsignField;
  value: string;
  signature: SignatureValue | null;
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

  if (isOwner) {
    return (
      <div
        style={style}
        className="flex items-center justify-center rounded-sm border border-dashed border-muted-foreground/40 bg-muted/30 text-[9px] text-muted-foreground"
      >
        Owner
      </div>
    );
  }

  const isSig =
    field.field_type === "signature" || field.field_type === "initials";

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
              ? signature!.data
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

  // text / name / date fillable inputs
  return (
    <input
      style={style}
      value={value}
      onChange={(e) => onChangeValue(e.target.value)}
      placeholder={
        field.field_type === "date"
          ? "Date"
          : field.field_type === "name"
          ? "Full name"
          : field.placeholder || "Enter text"
      }
      className="rounded-sm border-2 border-primary/60 bg-primary/5 px-1 text-[11px] outline-none focus:border-primary focus:bg-white"
    />
  );
}
