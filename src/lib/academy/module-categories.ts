export type CategoryClassifiable = {
  title: string;
  summary?: string | null;
  topic?: string | null;
  competency?: string | null;
  metadata?: Record<string, unknown> | null;
};

const CATEGORY_RULES: Array<{ slug: string; terms: string[] }> = [
  { slug: "fish-processing-and-value-addition", terms: ["fish processing", "post-harvest", "post harvest", "value-added", "value added", "food packaging", "fish floss", "fish stick", "churros"] },
  { slug: "marine-spatial-planning", terms: ["marine spatial", "spatial planning", "zoning"] },
  { slug: "fisheries-surveillance", terms: ["surveillance", "monitoring control", "illegal fishing", "iuu"] },
  { slug: "marine-conservation", terms: ["marine conservation", "coral", "mangrove", "biodiversity", "protected area"] },
  { slug: "climate-change", terms: ["climate", "adaptation", "mitigation", "carbon"] },
  { slug: "ocean-governance", terms: ["ocean governance", "marine policy", "maritime law", "governance"] },
  { slug: "blue-economy", terms: ["blue economy", "circular economy", "marine business"] },
  { slug: "ocean-literacy", terms: ["ocean literacy", "education", "awareness"] },
  { slug: "digital-marine", terms: ["website", "web application", "digital", "information system", "informatics", "manajemen informatika"] },
  { slug: "aquaculture", terms: ["aquaculture", "tilapia", "catfish", "biofloc", "hatchery", "fish feed", "fish health", "vaccination", "broodstock", "seed nursing", "water quality"] },
  { slug: "fisheries-management", terms: ["fisheries management", "fishery management", "stock assessment", "capture fisheries", "fisheries policy"] },
];

export function academyCategorySlugs(module: CategoryClassifiable): string[] {
  const metadata = module.metadata ?? {};
  const searchable = [
    module.title,
    module.summary,
    module.topic,
    module.competency,
    metadata.category,
    metadata.category_slug,
    metadata.sub_category,
    metadata.topic,
    metadata.competency,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  const matches = CATEGORY_RULES
    .filter(({ terms }) => terms.some((term) => searchable.includes(term)))
    .map(({ slug }) => slug);

  // Processing modules often mention a farmed species (for example catfish or
  // tilapia), but their learning outcome belongs to post-harvest/value addition,
  // not cultivation. Keep that explicit taxonomy from being diluted by species
  // keywords in the Aquaculture rule.
  if (matches.includes("fish-processing-and-value-addition")) {
    return ["fish-processing-and-value-addition"];
  }

  return matches;
}

export const MODULE_CATEGORY_LABELS: Record<string, string> = {
  "fisheries-management": "Fisheries Management",
  aquaculture: "Aquaculture",
  "marine-conservation": "Marine Conservation",
  "blue-economy": "Blue Economy",
  "climate-change": "Climate Change",
  "ocean-governance": "Ocean Governance",
  "marine-spatial-planning": "Marine Spatial Planning",
  "fisheries-surveillance": "Fisheries Surveillance",
  "fish-processing-and-value-addition": "Fish Processing & Value Addition",
  "ocean-literacy": "Ocean Literacy",
  "digital-marine": "Digital Marine",
};

export function primaryModuleCategory(module: CategoryClassifiable): string {
  return academyCategorySlugs(module)[0] ?? "ocean-literacy";
}
