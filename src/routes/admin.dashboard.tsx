import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", replace: true });
  },
});
