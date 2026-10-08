import { createFileRoute, redirect } from "@tanstack/react-router";

/** Backward-compatible alias for the curated expert directory. */
export const Route = createFileRoute("/experts/find")({
  beforeLoad: () => {
    throw redirect({ to: "/experts/directory" });
  },
});
