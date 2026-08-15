import { DashboardWelcome } from "@/components/layout/DashboardWelcome";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CalendarClock,
  FileText,
  FolderKanban,
  Users,
} from "lucide-react";

const stats = [
  { label: "Contacts", value: 0, icon: Users },
  { label: "Active Projects", value: 0, icon: FolderKanban },
  { label: "Upcoming Appointments", value: 0, icon: CalendarClock },
  { label: "Outstanding Invoices", value: 0, icon: FileText },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <DashboardWelcome />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  No data yet
                </p>
              </CardContent>
            </Card>
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
