import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { FormField } from "@/types/database";
import { executeWorkflowsForTrigger } from "@/lib/automation/executeWorkflow";

/**
 * POST /api/forms/[id]/submit
 * Public endpoint for form submission (no authentication required).
 * Uses admin client to bypass RLS for inserting submissions.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminClient = createAdminClient();
  const { id: formId } = await params;

  try {
    // Fetch the form to verify it exists and is active
    const { data: form, error: formError } = await adminClient
      .from("forms")
      .select("*")
      .eq("id", formId)
      .single();

    if (formError || !form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (form.status !== "active") {
      return NextResponse.json(
        { error: "This form is not currently accepting submissions" },
        { status: 400 }
      );
    }

    // Parse submission data
    const body = await req.json();
    const { submitted_data } = body;

    if (!submitted_data || typeof submitted_data !== "object") {
      return NextResponse.json(
        { error: "Invalid submission data" },
        { status: 400 }
      );
    }

    // Validate required fields
    const fields = (form.fields || []) as FormField[];
    const missingFields: string[] = [];

    fields.forEach((field: FormField) => {
      if (field.required && !submitted_data[field.id]) {
        missingFields.push(field.label);
      }
    });

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: `Required fields missing: ${missingFields.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Extract IP address and user agent
    const ip_address = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;
    const user_agent = req.headers.get("user-agent") || null;

    // Attempt to find or create a contact based on email field
    let contact_id = null;
    let auto_created_contact = false;

    // Look for email field in submitted data
    const emailField = fields.find((f: FormField) => f.type === "email");
    const submittedEmail = emailField ? submitted_data[emailField.id] : null;

    if (submittedEmail && typeof submittedEmail === "string") {
      // Check if contact with this email exists
      const { data: existingContact } = await adminClient
        .from("contacts")
        .select("id")
        .eq("workspace_id", form.workspace_id)
        .eq("email", submittedEmail)
        .single();

      if (existingContact) {
        contact_id = existingContact.id;
      } else {
        // Auto-create contact from submission data
        const nameField = fields.find((f: FormField) => 
          f.label.toLowerCase().includes("name") && f.type === "text"
        );
        const phoneField = fields.find((f: FormField) => f.type === "phone");

        const contactData: {
          workspace_id: string;
          type: "lead";
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
        } = {
          workspace_id: form.workspace_id,
          type: "lead",
          email: submittedEmail,
        };

        if (nameField && submitted_data[nameField.id]) {
          const fullName = submitted_data[nameField.id];
          if (typeof fullName === "string") {
            const nameParts = fullName.split(" ");
            contactData.first_name = nameParts[0] || null;
            contactData.last_name = nameParts.slice(1).join(" ") || null;
          }
        }

        if (phoneField && submitted_data[phoneField.id]) {
          const phone = submitted_data[phoneField.id];
          if (typeof phone === "string") {
            contactData.phone = phone;
          }
        }

        const { data: newContact, error: contactError } = await adminClient
          .from("contacts")
          .insert(contactData)
          .select("id")
          .single();

        if (!contactError && newContact) {
          contact_id = newContact.id;
          auto_created_contact = true;
        }
      }
    }

    const phoneField = fields.find((f: FormField) => f.type === "phone");
    const submittedPhone = phoneField ? submitted_data[phoneField.id] : null;
    const optedIn = fields.some((f: FormField) => {
      if (f.type !== "checkbox" && f.type !== "radio") return false;
      const label = f.label.toLowerCase();
      if (!/(sms|text|telegram|mobile message)/i.test(label)) return false;
      const val = submitted_data[f.id];
      if (val === true || val === "true" || val === "yes") return true;
      if (Array.isArray(val)) return val.length > 0;
      if (typeof val === "string" && val.trim()) return true;
      return false;
    });
    if (contact_id && optedIn) {
      const patch: Record<string, unknown> = {
        sms_opt_in_at: new Date().toISOString(),
      };
      if (typeof submittedPhone === "string" && submittedPhone.trim()) {
        patch.phone = submittedPhone.trim().slice(0, 40);
      }
      await adminClient
        .from("contacts")
        .update(patch)
        .eq("id", contact_id)
        .eq("workspace_id", form.workspace_id);
    }

    // Insert the form submission
    const { data: submission, error: submissionError } = await adminClient
      .from("form_submissions")
      .insert({
        form_id: formId,
        workspace_id: form.workspace_id,
        contact_id,
        submitted_data,
        ip_address,
        user_agent,
        auto_created_contact,
      })
      .select()
      .single();

    if (submissionError) {
      console.error("Error creating submission:", submissionError);
      return NextResponse.json(
        { error: "Failed to submit form" },
        { status: 500 }
      );
    }
    
    // Trigger automation workflows for form_submission
    if (submission) {
      executeWorkflowsForTrigger("form_submission", {
        form_id: formId,
        submission_id: submission.id,
        submission,
        contact_id,
        submitted_data,
      }, form.workspace_id).catch((err) => {
        console.error("Error executing form_submission workflows:", err);
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: form.success_message,
        submission_id: submission.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Form submission error:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your submission" },
      { status: 500 }
    );
  }
}
