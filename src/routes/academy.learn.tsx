import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireAuth } from "@/components/baruna/auth/RequireAuth";

export const Route = createFileRoute("/academy/learn")({
  component: AcademyLearnShell,
});

function AcademyLearnShell() {
  return (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  );
}
