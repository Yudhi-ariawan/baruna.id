import type { PublishedCatalogModule } from "@/lib/learning/learning.functions";

const CATEGORY_RULES: Array<{ slug: string; terms: string[] }> = [
  { slug: "fish-processing-and-value-addition", terms: ["fish processing", "post-harvest", "post harvest", "value-added", "value added", "food packaging", "fish floss", "fish stick", "churros"] },
  { slug: "marine-spatial-planning", terms: ["marine spatial", "spatial planning", "zoning"] },
  { slug: "fisheries-surveillance", terms: ["surveillance", "monitoring control", "illegal fishing", "iuu"] },
  { slug: "marine-conservation", terms: ["marine conservation", "coral", "mangrove", "biodiversity", "protected area"] },
  { slug: "climate-change", terms: ["climate", "adaptation", "mitigation", "carbon"] },
  { slug: "ocean-governance", terms: ["ocean governance", "marine policy", "maritime law", "governance"] },
  { slug: "blue-economy", terms: ["blue economy", "circular economy", "marine business"] },
  { slug: "ocean-literacy", terms: ["ocean literacy", "education", "awareness"] },
  { slug: "aquaculture", terms: ["aquaculture", "tilapia", "catfish", "biofloc", "hatchery", "fish feed", "fish health", "vaccination", "broodstock", "seed nursing", "water quality"] },
  { slug: "fisheries-management", terms: ["fisheries management", "fishery management", "stock assessment", "capture fisheries", "fisheries policy"] },
];

export function academyCategorySlugs(module: PublishedCatalogModule): string[] {
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

  return CATEGORY_RULES
    .filter(({ terms }) => terms.some((term) => searchable.includes(term)))
    .map(({ slug }) => slug);
}

