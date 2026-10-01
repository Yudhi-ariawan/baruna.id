import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/user")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
});
