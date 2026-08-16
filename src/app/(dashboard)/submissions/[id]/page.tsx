"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  ArrowLeft,
  User,
  Calendar,
  Loader2,
  Trash2,
  FileText,
} from "lucide-react";
import { FormSubmission, contactDisplayName } from "@/types/database";
import { formatDateTime } from "@/lib/format";

interface SubmissionDetailPageProps {
  params: { id: string };
}

export default function SubmissionDetailPage({
  params,
}: SubmissionDetailPageProps) {
  const { id } = params;
  const router = useRouter();

  const [submission, setSubmission] = useState<FormSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchSubmission();
    }
  }, [id]);

  const fetchSubmission = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/submissions/${id}`);
      const data = await res.json();
      setSubmission(data.submission);
    } catch (error) {
      console.error("Error fetching submission:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!submission) return;
    if (
      !confirm(
        "Are you sure you want to delete this submission? This action cannot be undone."
      )
    )
      return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/submissions/${submission.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete submission");
      router.push("/submissions");
    } catch (error) {
      console.error("Error deleting submission:", error);
      alert("Failed to delete submission");
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

  if (!submission) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Submission not found</p>
        <Button asChild>
          <Link href="/submissions">Back to Submissions</Link>
        </Button>
      </div>
    );
  }

  // Get field labels from form
  const formFields = submission.form?.fields || [];
  const getFieldLabel = (fieldId: string) => {
    const field = formFields.find((f) => f.id === fieldId);
    return field?.label || fieldId;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link href="/submissions">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Submissions
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Form Submission</h1>
          <p className="text-sm text-muted-foreground">
            {submission.form?.name || "Unknown Form"}
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      {/* Submission Info */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Submission Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Submitted</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(submission.submitted_at)}
                </p>
              </div>
            </div>

            {submission.contact && (
              <div className="flex items-start gap-3">
                <User className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Contact</p>
                  <Link
                    href={`/contacts/${submission.contact.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {contactDisplayName(submission.contact)}
                  </Link>
                  {submission.auto_created_contact && (
                    <Badge
                      variant="outline"
                      className="mt-1 border-blue-500/40 text-blue-400"
                    >
                      Auto-created from submission
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {submission.ip_address && (
              <div>
                <p className="text-sm font-medium">IP Address</p>
                <p className="text-sm text-muted-foreground">
                  {submission.ip_address}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Form Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Form Name</p>
              <Link
                href={`/forms/${submission.form_id}`}
                className="text-sm text-primary hover:underline"
              >
                {submission.form?.name || "Unknown Form"}
              </Link>
            </div>
            <div>
              <p className="text-sm font-medium">Total Fields</p>
              <p className="text-sm text-muted-foreground">
                {Object.keys(submission.submitted_data).length} fields submitted
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submitted Data */}
      <Card>
        <CardHeader>
          <CardTitle>Submitted Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Response</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(submission.submitted_data).map(
                ([fieldId, value]) => (
                  <TableRow key={fieldId}>
                    <TableCell className="font-medium">
                      {getFieldLabel(fieldId)}
                    </TableCell>
                    <TableCell>
                      {Array.isArray(value) ? (
                        <ul className="list-disc list-inside">
                          {value.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="whitespace-pre-wrap">{value}</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
