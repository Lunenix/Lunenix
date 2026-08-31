"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, Loader2 } from "lucide-react";
import { FormSubmission, contactDisplayName } from "@/types/database";
import { formatDateTime } from "@/lib/format";

export default function SubmissionsPage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeWorkspace?.id) {
      fetchSubmissions();
    }
  }, [activeWorkspace?.id]);

  const fetchSubmissions = async () => {
    if (!activeWorkspace?.id) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/submissions?workspaceId=${activeWorkspace.id}`
      );
      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (error) {
      console.error("Error fetching submissions:", error);
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
          <h1 className="text-3xl font-bold">Form Submissions</h1>
          <p className="text-muted-foreground">
            View and manage all form submissions
          </p>
        </div>
      </div>

      {/* Empty State */}
      {submissions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">
              No submissions yet
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Submissions will appear here when someone fills out your forms
            </p>
            <Button asChild>
              <Link href="/forms">View Forms</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Submissions Table */
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Form</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell className="font-medium">
                    {submission.form?.name || "Unknown Form"}
                  </TableCell>
                  <TableCell>
                    {submission.contact ? (
                      <Link
                        href={`/contacts/${submission.contact.id}`}
                        className="text-primary hover:underline"
                      >
                        {contactDisplayName(submission.contact)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">
                        No contact
                      </span>
                    )}
                    {submission.auto_created_contact && (
                      <Badge
                        variant="outline"
                        className="ml-2 border-blue-500/40 text-blue-400"
                      >
                        Auto-created
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(submission.submitted_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-green-500/40 text-green-400">
                      Completed
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/submissions/${submission.id}`}>
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
