import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/experts/portal/module-review-status")({
  beforeLoad: () => {
    throw redirect({ to: "/experts/portal/review-status" });
  },
});
