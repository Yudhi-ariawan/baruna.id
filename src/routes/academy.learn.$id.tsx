import { useState, useEffect } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyCourseEnrollmentStatus } from "@/lib/learning/enrollment-application.functions";
import { AlertCircle, Lock } from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { LMS_MODULES, type LmsModule } from "@/data/lms";
import { useApplication } from "@/lib/application";
import { masterByCode, type MasterModule } from "@/data/masterModules";
import {
  fullTrainingCourseId,
  resolveFullTrainingSlug,
} from "@/lib/learning/full-training-enrollment";
import {
  getEnrolledModuleContent,
  getPublishedModuleDetail,
  type PublishedModuleDetail,
} from "@/lib/learning/learning.functions";
import { DynamicModuleLmsPlayer } from "@/components/baruna/academy/DynamicModuleLmsPlayer";
import { MasterModuleLmsPlayer } from "@/components/baruna/academy/MasterModuleLmsPlayer";
import { FullTrainingLearningDashboard } from "@/components/baruna/academy/full-training/FullTrainingLearningDashboard";

type LearnLoaderData =
  | { kind: "dynamic"; module: PublishedModuleDetail }
  | {
      kind: "master";
      master: MasterModule;
      lms: LmsModule | undefined;
    }
  | { kind: "program"; id: string };

export const Route = createFileRoute("/academy/learn/$id")({
  loader: async ({ params }): Promise<LearnLoaderData> => {
    // 1. Check if it's a static master module
    const master = masterByCode[params.id];
    if (master) {
      const lms = LMS_MODULES.find((m) => m.id === master.lmsId);
      return { kind: "master", master, lms };
    }

    // 2. Check if it's a dynamic module from module_registry. The loader only
    // gets the public preview; the material is fetched after the access check.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);
    if (isUuid) {
      try {
        const publishedModule = await getPublishedModuleDetail({ data: { moduleId: params.id } });
        if (publishedModule) {
          return { kind: "dynamic", module: publishedModule };
        }
      } catch (err) {
        console.warn("Could not load dynamic module for learn route:", err);
      }
      throw notFound();
    }

    // 3. Otherwise treat as a program / application ID
    return { kind: "program", id: params.id };
  },
  head: () => ({
    meta: [
      { title: "Learning Space — Academy — BARUNA" },
      { name: "description", content: "BARUNA Academy self-paced learning space and interactive training programs." },
    ],
  }),
  errorComponent: ({ error }: { error: any }) => (
    <AcademyShell active="my-learning">
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold text-navy">Unable to Load Learning Space</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {String(error?.message || error || "An error occurred while loading the learning space. Please try again or return to My Learning.")}
        </p>
        <Link to="/academy/learn" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-white">
          Back to My Learning
        </Link>
      </div>
    </AcademyShell>
  ),
  notFoundComponent: () => (
    <AcademyShell active="my-learning">
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold text-navy">Learning space not found</h1>
        <Link to="/academy/learn" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-white">
          Back to My Learning
        </Link>
      </div>
    </AcademyShell>
  ),
  component: LearningDashboard,
});

function LearningDashboard() {
  const loaderData = Route.useLoaderData();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
      setAuthChecked(true);
    });
  }, []);

  // A Full Training program is enrolled under its slug; the local application
  // record only tells us which program this learning-room id belongs to.
  const fullApp = useApplication(loaderData.kind === "program" ? loaderData.id : "");
  const programSlug =
    loaderData.kind === "program" ? resolveFullTrainingSlug(loaderData.id, fullApp?.slug) : null;
  const courseId =
    loaderData.kind === "dynamic"
      ? loaderData.module.id
      : loaderData.kind === "master"
        ? loaderData.master.code
        : programSlug
          ? fullTrainingCourseId(programSlug)
          : "";

  const getStatusFn = useServerFn(getMyCourseEnrollmentStatus);
  const { data: enrollmentStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["course-enrollment-status", courseId, userId],
    queryFn: () => getStatusFn({ data: { courseId } }),
    enabled: Boolean(userId && courseId),
    staleTime: 1000 * 60 * 2,
  });

  // Access rule (PB-ACA-03), for every kind of learning room: a learner-capable
  // role and an enrollment approved by an administrator, both read from the
  // server. Browser storage and Demo Mode are never evidence of approval.
  const hasApprovedEnrollment =
    enrollmentStatus?.status === "approved" || enrollmentStatus?.isEnrolled === true;
  const hasParticipantAccess = enrollmentStatus?.hasParticipantRole === true;
  const isApproved = hasParticipantAccess && hasApprovedEnrollment;

  // Dynamic (database) modules are gated by the server (DynamicModuleRoom ->
  // getEnrolledModuleContent -> public.can_access_module_content), which also admits the
  // module's author and admins; only a signed-in user is required here. Every other kind
  // of room needs the approved enrollment above. localStorage and Demo Mode never open them.
  const isDynamicModule = loaderData.kind === "dynamic";
  const accessCheckPending =
    !authChecked || (!isDynamicModule && Boolean(userId && courseId && statusLoading));
  const accessDenied =
    authChecked && (!userId || (!isDynamicModule && (!courseId || (!statusLoading && !isApproved))));

  useEffect(() => {
    if (!accessDenied) return;
    if (loaderData.kind !== "program") {
      void navigate({ to: "/academy/self-paced/$code", params: { code: courseId }, replace: true });
    } else if (fullApp) {
      void navigate({ to: "/academy/applications/$id", params: { id: fullApp.id }, replace: true });
    } else if (programSlug) {
      void navigate({ to: "/academy/training/$slug", params: { slug: programSlug }, replace: true });
    } else {
      void navigate({ to: "/academy/learn", replace: true });
    }
  }, [accessDenied, courseId, fullApp, programSlug, loaderData.kind, navigate]);

  // Never render learning content while authentication/enrollment is unresolved,
  // or during the redirect back to the official enrollment page.
  if (accessCheckPending || accessDenied) {
    return (
      <AccessNotice
        title={accessCheckPending ? "Memeriksa Akses Ruang Belajar" : "Mengalihkan ke Halaman Pendaftaran"}
        message="Ruang belajar hanya tersedia bagi peserta yang telah disetujui. Anda akan diarahkan ke halaman detail pelatihan."
      />
    );
  }

  if (loaderData.kind === "dynamic") {
    return <DynamicModuleRoom moduleId={loaderData.module.id} userId={userId} />;
  }

  if (loaderData.kind === "master") {
    return <MasterModuleLmsPlayer master={loaderData.master} lms={loaderData.lms} />;
  }

  return <FullTrainingLearningDashboard id={loaderData.id} />;
}

/** Loads the module material from the server, which re-checks the approved enrollment. */
function DynamicModuleRoom({ moduleId, userId }: { moduleId: string; userId: string | null }) {
  const getContentFn = useServerFn(getEnrolledModuleContent);
  const { data: content, error, isLoading } = useQuery({
    queryKey: ["enrolled-module-content", moduleId, userId],
    queryFn: () => getContentFn({ data: { moduleId } }),
    // Material links are signed for 1 hour (MATERIAL_LINK_TTL_SECONDS). They are
    // fetched fresh whenever the room opens, but never swapped while it is open:
    // a new link would reload a video or PDF the participant is reading.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  if (isLoading) {
    return (
      <AccessNotice
        title="Memuat Materi Pelatihan"
        message="Materi sedang disiapkan untuk akun Anda."
      />
    );
  }
  if (error || !content) {
    return (
      <AcademyShell active="self-paced">
        <div className="mx-auto my-8 max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-100 text-red-700 shadow-xs">
            <AlertCircle className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-display text-xl font-bold text-navy">Materi Belum Dapat Dibuka</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {error instanceof Error ? error.message : "Terjadi kendala saat memuat materi pelatihan."}
          </p>
          <Link
            to="/academy/self-paced/$code"
            params={{ code: moduleId }}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-white"
          >
            Kembali ke Halaman Pelatihan
          </Link>
        </div>
      </AcademyShell>
    );
  }
  return <DynamicModuleLmsPlayer module={content} />;
}

function AccessNotice({ title, message }: { title: string; message: string }) {
  return (
    <AcademyShell active="self-paced">
      <div className="mx-auto my-8 max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-700 shadow-xs">
          <Lock className="h-7 w-7" />
        </span>
        <h2 className="mt-4 font-display text-xl font-bold text-navy">{title}</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{message}</p>
      </div>
    </AcademyShell>
  );
}
