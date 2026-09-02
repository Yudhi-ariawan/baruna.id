import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy route — redirected to the consolidated Self-Paced Course detail page,
// preserving the module code parameter for deep-linked URLs.
export const Route = createFileRoute("/academy/short-courses/$code")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/academy/self-paced/$code",
      params: { code: params.code },
      replace: true,
    });
  },
});
