import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminAccess } from "@/lib/admin/users.functions";

export const Route = createFileRoute("/admin/")({
  component: AdminIndex,
});

function AdminIndex() {
  const getAccess = useServerFn(getAdminAccess);
  const query = useQuery({ queryKey: ["admin", "access"], queryFn: () => getAccess(), retry: false });
  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading administration…</p>;
  if (query.data?.canReadUsers) return <Navigate to="/admin/users" />;
  return <Navigate to="/admin/reviews" />;
}
