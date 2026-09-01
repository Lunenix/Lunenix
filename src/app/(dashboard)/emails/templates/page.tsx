"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Plus, Search } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { EmailTemplate } from "@/types/database";

export default function EmailTemplatesPage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (activeWorkspace) {
      seedAndFetch();
    }
  }, [activeWorkspace]);

  const seedAndFetch = async () => {
    if (!activeWorkspace) return;
    try {
      await fetch("/api/email-templates/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: activeWorkspace.id }),
      });
    } catch {
      // non-fatal
    }
    await fetchTemplates();
  };

  const fetchTemplates = async () => {
    if (!activeWorkspace) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/email-templates?workspaceId=${activeWorkspace.id}`
      );
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTemplates = templates.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
    );
  });

  if (workspaceLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Mail className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No workspace selected</h3>
        <p className="text-sm text-muted-foreground">
          Please select a workspace to view email templates
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Link href="/emails/templates/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </Link>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No email templates yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first email template to get started
            </p>
            <Link href="/emails/templates/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="gap-4">
            <CardTitle>All Templates</CardTitle>
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or subject..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No templates match &ldquo;{search}&rdquo;.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/emails/templates/${template.id}`}
                          className="hover:underline"
                        >
                          {template.name}
                        </Link>
                        {template.is_system_default && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            System default
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {template.subject}
                      </TableCell>
                      <TableCell>{formatDateTime(template.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/emails/templates/${template.id}`}>
                          <Button variant="ghost" size="sm">
                            Edit
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
