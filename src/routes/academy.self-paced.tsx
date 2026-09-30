import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/academy/self-paced")({
  head: () => ({
    meta: [
      { title: "Self-Paced Courses — BARUNA Academy" },
      {
        name: "description",
        content:
          "Standalone BARUNA learning modules with credit recognition toward Full Training Programs.",
      },
    ],
    links: [{ rel: "canonical", href: "/academy/self-paced" }],
  }),
  component: SelfPacedLayout,
});

function SelfPacedLayout() {
  return <Outlet />;
}
