"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type PhotoPipelineSession = {
  id: string;
  client: string;
  title: string;
  session_type: string;
  coverage_hours: number | null;
  shoot_status: string;
  editing_stage: string;
  gallery_url: string | null;
};

export function PhotographyPipeline({
  sessions,
}: {
  sessions: PhotoPipelineSession[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Post-production & galleries</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Booked and in-progress shoots from Photo tables — not contact
          metadata. Gallery links are URLs you stored; this is not Pixieset or
          live RAW ingest.
        </p>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground">
            No booked or editing shoots yet. Add a shoot or log session specs.
          </p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{session.client}</p>
                <p className="text-xs text-muted-foreground">
                  {session.session_type}
                  {session.coverage_hours != null
                    ? ` · ${session.coverage_hours} hours`
                    : ""}
                  {` · ${session.shoot_status}`}
                </p>
              </div>
              <div className="sm:text-right">
                <Badge variant="secondary">{session.editing_stage}</Badge>
                {session.gallery_url ? (
                  <a
                    href={session.gallery_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-xs underline"
                  >
                    Open gallery URL
                  </a>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
