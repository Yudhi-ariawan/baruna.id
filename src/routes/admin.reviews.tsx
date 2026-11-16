import { createFileRoute, redirect } from "@tanstack/react-router";

// Old module review queue; module verification lives in the curation console.
export const Route = createFileRoute("/admin/reviews")({
  beforeLoad: () => {
    throw redirect({ to: "/governance/modules", replace: true });
  },
});
