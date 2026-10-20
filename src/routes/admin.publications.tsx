import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved to the curation console (/governance), which opens per role (Slide 16).
// Kept so old links and bookmarks still land on the right page.
export const Route = createFileRoute("/admin/publications")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/governance/publications", search, replace: true });
  },
});
