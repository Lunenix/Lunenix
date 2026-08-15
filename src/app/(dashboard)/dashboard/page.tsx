"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardWelcome } from "@/components/layout/DashboardWelcome";
import { CreateWorkspaceForm } from "@/components/workspace/CreateWorkspaceForm";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ClipboardList,
  FileSignature,
  FolderKanban,
  ListChecks,
  Loader2,
  Mail,
  Receipt,
  Users,
} from "lucide-react";

export default function DashboardPage() {
  const { activeWorkspace, isLoading } = useWorkspace();
  const [counts, setCounts] = useState({
    contacts: 0,
    activeProjects: 0,
    openTasks: 0,
    activeContracts: 0,
    outstandingInvoices: 0,
    formSubmissions: 0,
    emailsSent: 0,
  });

  useEffect(() => {
    if (!activeWorkspace) return;
    let cancelled = false;
    (async () => {
      const [cRes, pRes, tRes, ctRes, iRes, sRes, eRes] = await Promise.all([
        fetch(`/api/contacts?workspaceId=${activeWorkspace.id}`),
        fetch(`/api/projects?workspaceId=${activeWorkspace.id}`),
        fetch(`/api/tasks?workspaceId=${activeWorkspace.id}`),
        fetch(`/api/contracts?workspaceId=${activeWorkspace.id}`),
        fetch(`/api/invoices?workspaceId=${activeWorkspace.id}`),
        fetch(`/api/submissions?workspaceId=${activeWorkspace.id}`),
        fetch(`/api/emails/logs?workspaceId=${activeWorkspace.id}`),
      ]);
      const cJson = await cRes.json().catch(() => ({}));
      const pJson = await pRes.json().catch(() => ({}));
      const tJson = await tRes.json().catch(() => ({}));
      const ctJson = await ctRes.json().catch(() => ({}));
      const iJson = await iRes.json().catch(() => ({}));
      const sJson = await sRes.json().catch(() => ({}));
      const eJson = await eRes.json().catch(() => ({}));
      if (cancelled) return;
      const projects = pJson.projects ?? [];
      const tasks = tJson.tasks ?? [];
      const contracts = ctJson.contracts ?? [];
      const invoices = iJson.invoices ?? [];
      const submissions = sJson.submissions ?? [];
      const emails = eJson.logs ?? [];
      setCounts({
        contacts: (cJson.contacts ?? []).length,
        activeProjects: projects.filter(
          (p: { status: string }) => p.status === "active"
        ).length,
        openTasks: tasks.filter(
          (t: { status: string }) => t.status !== "done"
        ).length,
        activeContracts: contracts.filter(
          (c: { status: string }) => c.status === "active"
        ).length,
        outstandingInvoices: invoices.filter(
          (i: { status: string }) => i.status === "sent" || i.status === "overdue"
        ).length,
        formSubmissions: submissions.length,
        emailsSent: emails.filter(
          (e: { status: string }) => e.status === "sent"
        ).length,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace]);

  const stats = [
    { label: "Contacts", value: counts.contacts, icon: Users, href: "/contacts" },
    {
      label: "Active Projects",
      value: counts.activeProjects,
      icon: FolderKanban,
      href: "/projects",
    },
    {
      label: "Open Tasks",
      value: counts.openTasks,
      icon: ListChecks,
      href: "/tasks",
    },
    {
      label: "Active Contracts",
      value: counts.activeContracts,
      icon: FileSignature,
      href: "/contracts",
    },
    {
      label: "Outstanding Invoices",
      value: counts.outstandingInvoices,
      icon: Receipt,
      href: "/invoices",
    },
    {
      label: "Form Submissions",
      value: counts.formSubmissions,
      icon: ClipboardList,
      href: "/submissions",
    },
    {
      label: "Emails Sent",
      value: counts.emailsSent,
      icon: Mail,
      href: "/emails",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return <CreateWorkspaceForm />;
  }

  return (
    <div className="space-y-8">
      <DashboardWelcome />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="transition-colors hover:border-primary/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Getting started</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This is the foundation of your Lunenix workspace. Contacts, projects,
          the calendar, and invoicing will appear here as they are built out in
          the next phases.
        </CardContent>
      </Card>
    </div>
  );
}
