import { redirect } from "next/navigation";

// The Contracts and E-Signatures modules have been unified into a single section
// powered by the e-signature engine. The old /contracts route now redirects to it.
export default function ContractsRedirect() {
  redirect("/esign");
}
