import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard_/user")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
  component: () => null,
});
