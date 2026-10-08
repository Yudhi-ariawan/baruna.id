import { createServerFn } from "@tanstack/react-start";
import { LMS_MODULES } from "@/data/lms";
import { getModuleStorageSignedUrl } from "@/lib/learning/learning.functions";

export type CurriculumModuleDoc = {
  no: number;
  title: string;
  pdfUrl: string | null;
  fileName: string | null;
  source: "database" | "lms";
  moduleDbId: string | null;
};

// 13 Official Modules Keyword Matchers
const CURRICULUM_MATCH_RULES: Array<{
  no: number;
  title: string;
  keywords: string[];
}> = [
  {
    no: 1,
    title: "Preparing Biofloc Containers and Media",
    keywords: ["container", "biofloc container", "starter media", "biofloc containers and media"],
  },
  {
    no: 2,
    title: "Preparation of Biofloc Pond Media",
    keywords: ["pond media", "biofloc pond", "c/n ratio", "probiotic", "preparation of biofloc pond"],
  },
  {
    no: 3,
    title: "Catfish Hatchery and Seed Management",
    keywords: ["catfish hatchery", "catfish seed", "broodstock", "induced spawning"],
  },
  {
    no: 4,
    title: "Catfish Aquaculture",
    keywords: ["catfish aquaculture", "catfish culture", "catfish grow-out", "density"],
  },
  {
    no: 5,
    title: "Making Catfish Feed from Maggot",
    keywords: ["catfish feed from maggot", "catfish feed", "bsf", "maggot"],
  },
  {
    no: 6,
    title: "Tilapia Hatchery and Management",
    keywords: ["tilapia hatchery", "tilapia seed", "sex reversal", "fry collection"],
  },
  {
    no: 7,
    title: "Tilapia Cultivation Using Biofloc System",
    keywords: ["tilapia cultivation using biofloc", "tilapia cultivation", "tilapia biofloc"],
  },
  {
    no: 8,
    title: "Vaccine and Vaccination in Tilapia Farming",
    keywords: ["vaccine", "vaccination", "tilapia farming", "fish health"],
  },
  {
    no: 9,
    title: "Making Tilapia Feed from Maggot",
    keywords: ["making tilapia feed from maggot", "tilapia feed", "maggot meal"],
  },
  {
    no: 10,
    title: "Making Catfish Floss",
    keywords: ["making catfish floss", "catfish floss", "abon", "floss"],
  },
  {
    no: 11,
    title: "Fishbone Cookies",
    keywords: ["fishbone cookies", "bone cookies", "calcium", "cookies"],
  },
  {
    no: 12,
    title: "Fish Stick Cheese",
    keywords: ["fish stick cheese", "stick cheese", "cheese", "processing method of fish stick cheese"],
  },
  {
    no: 13,
    title: "Fish Bone Churros Making Technique",
    keywords: ["fish bone churros", "churros", "flour preparation"],
  },
];

// Helper to find the primary PDF document in a module's metadata
function findPdfInMeta(meta: Record<string, unknown>): Record<string, unknown> | null {
  const attached: Array<Record<string, unknown>> = Array.isArray(meta.attached_resources)
    ? (meta.attached_resources as Array<Record<string, unknown>>)
    : Array.isArray(meta.documents)
    ? (meta.documents as Array<Record<string, unknown>>)
    : [];

  const found = attached.find((doc) => {
    const name = String(doc.fileName || doc.name || "").toLowerCase();
    const type = String(doc.type || doc.category || doc.fileType || "").toLowerCase();
    const path = String(doc.path || "").toLowerCase();
    return (
      name.endsWith(".pdf") ||
      path.endsWith(".pdf") ||
      type.includes("pdf") ||
      type === "dokumen utama" ||
      type === "verified module document"
    );
  });

  return found ?? null;
}

/**
 * Server function to resolve the PDF document for each of the 13 curriculum modules.
 * - Supports both keyword-matched modules and sequentially uploaded local/production modules ("dan seterusnya").
 * - Extracts signed URLs directly from Supabase Storage.
 * - Fallbacks to official LMS assets if not yet uploaded.
 */
export const getCurriculumPdfMap = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<number, CurriculumModuleDoc>> => {
    const result: Record<number, CurriculumModuleDoc> = {};

    // 1. Initialize with fallback LMS assets (1..13)
    for (const rule of CURRICULUM_MATCH_RULES) {
      const lmsMod = LMS_MODULES.find((m) => m.no === rule.no);
      result[rule.no] = {
        no: rule.no,
        title: rule.title,
        pdfUrl: lmsMod?.resources.pdf.url ?? null,
        fileName: `${rule.no}-${rule.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
        source: "lms",
        moduleDbId: null,
      };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 2. Query published modules from module_registry
      const { data: dbMods, error } = await supabaseAdmin
        .from("module_registry")
        .select("id, title, metadata, content_outline, current_status, created_at")
        .eq("current_status", "published")
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("Could not query module_registry for curriculum docs:", error.message);
        return result;
      }

      if (!dbMods || dbMods.length === 0) {
        return result;
      }

      // Track slots already filled by direct match and modules already used
      const assignedSlots = new Set<number>();
      const usedModuleIds = new Set<string>();

      // List of all DB modules with valid resolved PDFs
      const dbModulesWithPdfs: Array<{
        id: string;
        title: string;
        downloadUrl: string;
        fileName: string;
        topicLower: string;
      }> = [];

      for (const mod of dbMods) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const meta = ((mod.metadata as Record<string, any>) || {}) as Record<string, any>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const outline = ((mod.content_outline as Record<string, any>) || {}) as Record<string, any>;
        const pdfDoc = findPdfInMeta(meta);

        if (pdfDoc) {
          let downloadUrl: string | null = null;
          const storagePath = typeof pdfDoc.path === "string" ? pdfDoc.path : null;

          if (storagePath) {
            downloadUrl = await getModuleStorageSignedUrl(
              supabaseAdmin,
              storagePath,
              86400,
              typeof pdfDoc.bucket === "string" ? pdfDoc.bucket : undefined
            );
          } else if (
            typeof pdfDoc.url === "string" &&
            (pdfDoc.url.startsWith("http://") || pdfDoc.url.startsWith("https://"))
          ) {
            downloadUrl = pdfDoc.url;
          } else if (
            typeof pdfDoc.downloadUrl === "string" &&
            (pdfDoc.downloadUrl.startsWith("http://") || pdfDoc.downloadUrl.startsWith("https://"))
          ) {
            downloadUrl = pdfDoc.downloadUrl;
          }

          if (downloadUrl) {
            dbModulesWithPdfs.push({
              id: mod.id,
              title: mod.title || "",
              downloadUrl,
              fileName: String(pdfDoc.fileName || pdfDoc.name || `${mod.title}.pdf`),
              topicLower: String(outline.topic || meta.topic || "").toLowerCase(),
            });
          }
        }
      }

      // 3. Pass 1: Try keyword & title match
      for (const item of dbModulesWithPdfs) {
        const titleLower = item.title.toLowerCase();

        for (const rule of CURRICULUM_MATCH_RULES) {
          if (assignedSlots.has(rule.no)) continue;

          const isDirectTitleMatch = titleLower.includes(rule.title.toLowerCase());
          const isKeywordMatch = rule.keywords.some(
            (kw) => titleLower.includes(kw.toLowerCase()) || item.topicLower.includes(kw.toLowerCase())
          );

          if (isDirectTitleMatch || isKeywordMatch) {
            result[rule.no] = {
              no: rule.no,
              title: rule.title,
              pdfUrl: item.downloadUrl,
              fileName: item.fileName,
              source: "database",
              moduleDbId: item.id,
            };
            assignedSlots.add(rule.no);
            usedModuleIds.add(item.id);
            break;
          }
        }
      }

      // 4. Pass 2: Sequential allocation for remaining uploaded modules ("dan seterusnya")
      // Maps user's uploaded modules sequentially into unfilled slots 1..13
      const unusedModules = dbModulesWithPdfs.filter((item) => !usedModuleIds.has(item.id));
      let unusedIdx = 0;

      for (let slot = 1; slot <= 13; slot++) {
        if (assignedSlots.has(slot)) continue;
        if (unusedIdx >= unusedModules.length) break;

        const modItem = unusedModules[unusedIdx];
        const rule = CURRICULUM_MATCH_RULES.find((r) => r.no === slot);

        result[slot] = {
          no: slot,
          title: rule?.title ?? `Modul ${slot}`,
          pdfUrl: modItem.downloadUrl,
          fileName: modItem.fileName,
          source: "database",
          moduleDbId: modItem.id,
        };

        assignedSlots.add(slot);
        unusedIdx++;
      }
    } catch (err) {
      console.warn("Failed resolving curriculum database module PDFs:", err);
    }

    return result;
  }
);
