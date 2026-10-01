import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard_/admin")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", replace: true });
  },
  component: () => null,
});
