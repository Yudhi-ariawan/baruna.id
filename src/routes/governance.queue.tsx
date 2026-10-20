import { createFileRoute, redirect } from "@tanstack/react-router";

// The reviewer queue now lives in the curation console menu "Permintaan
// Pelatihan" (the only kind reviewed through assignments).
export const Route = createFileRoute("/governance/queue")({
  beforeLoad: () => {
    throw redirect({ to: "/governance/training-needs", replace: true });
  },
});
