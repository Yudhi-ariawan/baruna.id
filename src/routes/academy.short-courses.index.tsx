import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy route — redirected to the consolidated Self-Paced Course page.
export const Route = createFileRoute("/academy/short-courses/")({
  beforeLoad: () => {
    throw redirect({ to: "/academy/self-paced", replace: true });
  },
});
