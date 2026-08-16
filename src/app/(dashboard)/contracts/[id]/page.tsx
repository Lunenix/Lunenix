import { redirect } from "next/navigation";

// The Contracts and E-Signatures modules have been unified into a single section
// powered by the e-signature engine. Old per-contract detail routes redirect to
// the unified section.
export default function ContractDetailRedirect() {
  redirect("/esign");
}
