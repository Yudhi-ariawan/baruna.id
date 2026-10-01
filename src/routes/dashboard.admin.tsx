import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/admin")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", replace: true });
  },
});
