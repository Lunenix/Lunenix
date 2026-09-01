import { EmailTemplateEditorScreen } from "@/components/emails/EmailTemplateEditorScreen";

export const dynamic = "force-dynamic";

export default function EditEmailTemplatePage({
  params,
}: {
  params: { id: string };
}) {
  return <EmailTemplateEditorScreen templateId={params.id} />;
}
