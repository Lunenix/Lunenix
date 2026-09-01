import { Type, type FunctionDeclaration } from "@google/genai";

/**
 * Luna outbound mail. Sends via workspace Resend or SMTP (`sendServerEmail`).
 * `to` may be an address or a contact name in this workspace.
 */
export const sendEmailTool: FunctionDeclaration = {
  name: "send_email",
  description:
    "Send an outbound email from this workspace via Resend or the workspace SMTP account. Only call when the user wants it sent now. Do not pass a workspace id.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      to: {
        type: Type.STRING,
        description: "Recipient email address, or a contact name in this workspace",
      },
      to_email: {
        type: Type.STRING,
        description: "Same as to",
      },
      to_name: { type: Type.STRING, description: "Optional recipient display name" },
      contact_name: {
        type: Type.STRING,
        description: "Lookup recipient by contact name if to is omitted",
      },
      contact_email: { type: Type.STRING },
      subject: { type: Type.STRING, description: "Email subject line" },
      body: {
        type: Type.STRING,
        description: "Plain email body. Do not include API keys or passwords.",
      },
    },
    required: ["subject", "body"],
  },
};
