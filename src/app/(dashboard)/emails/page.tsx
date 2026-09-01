"use client";

import { useEffect, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Send } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { getStatusBadgeVariant } from "@/lib/status";
import { EMAIL_STATUS_LABELS, contactDisplayName } from "@/types/database";
import type { EmailLog } from "@/types/database";
import { SendEmailDialog } from "@/components/emails/SendEmailDialog";
import type { EmailTemplate } from "@/types/database";

export default function EmailsHistoryPage() {
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  useEffect(() => {
    if (activeWorkspace) {
      fetchLogs();
      fetchTemplates();
    }
  }, [activeWorkspace]);

  const fetchLogs = async () => {
    if (!activeWorkspace) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/emails/logs?workspaceId=${activeWorkspace.id}`
      );
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error("Error fetching email logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    if (!activeWorkspace) return;

    try {
      const response = await fetch(
        `/api/email-templates?workspaceId=${activeWorkspace.id}`
      );
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

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
          Please select a workspace to view emails
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={() => setSendDialogOpen(true)}>
          <Send className="mr-2 h-4 w-4" />
          Send Email
        </Button>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No emails sent yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Send your first email to get started
            </p>
            <Button onClick={() => setSendDialogOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              Send Email
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sent Emails</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {log.recipient_name || log.recipient_email}
                        </div>
                        {log.recipient_name && (
                          <div className="text-sm text-muted-foreground">
                            {log.recipient_email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.contact ? (
                        <span className="text-sm">
                          {contactDisplayName(log.contact)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {log.subject}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(log.status)}>
                        {EMAIL_STATUS_LABELS[log.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(log.sent_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <SendEmailDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        workspaceId={activeWorkspace.id}
        templates={templates}
        onSent={() => {
          fetchLogs();
        }}
      />
    </div>
  );
}
