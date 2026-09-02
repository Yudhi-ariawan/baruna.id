import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/experts/portal")({
  component: () => <Outlet />,
});
