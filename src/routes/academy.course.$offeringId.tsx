import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { LearningDashboard } from "@/components/baruna/learning/LearningDashboard";
import { getOfferingByCode } from "@/lib/learning/learning.functions";

export const Route = createFileRoute("/academy/course/$offeringId")({
  loader: async ({ params }) => {
    const offering = await getOfferingByCode({ data: { code: params.offeringId } });
    if (!offering) throw notFound();
    return { offering };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { offering } = loaderData;
    const title = `${offering.master_courses.title} — ${offering.offering_title} — BARUNA Academy`;
    const description = offering.master_courses.description ?? offering.offering_title;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-lg p-8 text-center">
      <h1 className="font-display text-2xl font-bold text-navy">Course offering not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The course offering you requested does not exist or has been closed.
      </p>
      <Link to="/academy/programs" className="mt-4 inline-block text-marine underline">
        Browse programs
      </Link>
    </div>
  ),
  component: CoursePage,
});

function CoursePage() {
  const { offering } = Route.useLoaderData();
  return <LearningDashboard offering={offering} />;
}
