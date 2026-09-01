"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, User, Activity, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActivityLog } from "@/types/database";

interface WorkspaceActivityFeedProps {
  workspaceId: string;
}

export function WorkspaceActivityFeed({
  workspaceId,
}: WorkspaceActivityFeedProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(
        `/api/activity-logs?workspaceId=${encodeURIComponent(workspaceId)}`
      );
      if (!res.ok) throw new Error("Failed to load activity");
      const data = await res.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err) {
      console.error("Activity feed error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    setIsLoading(true);
    void fetchActivity();
    const interval = setInterval(() => void fetchActivity(), 15000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Card className="border-border/40">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-bold">
            Recent Workspace Activity
          </CardTitle>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void fetchActivity()}
          className="h-8 w-8"
          aria-label="Refresh activity"
        >
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No recent activity recorded. Actions taken by you or Luna will
            appear here.
          </p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-lg border border-border/20 bg-muted/20 p-2.5 text-xs transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center space-x-3">
                  <Badge
                    variant={log.actor_type === "luna" ? "default" : "secondary"}
                    className="flex h-6 w-6 items-center justify-center rounded-full p-0"
                  >
                    {log.actor_type === "luna" ? (
                      <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                    ) : (
                      <User className="h-3.5 w-3.5" />
                    )}
                  </Badge>
                  <div>
                    <p className="font-medium text-foreground">
                      {log.description}
                    </p>
                    <p className="text-[10px] capitalize text-muted-foreground">
                      {log.actor_type === "luna"
                        ? "Luna AI Assistant"
                        : "Workspace Member"}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {formatTimestamp(log.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
