// ============================================================================
// BARUNA Academy — Module quiz banks
// ----------------------------------------------------------------------------
// End-of-module multiple-choice quizzes for the training program
// "International Training on Fisheries for African Countries".
//
// Each bank is keyed by its LMS module id (see src/data/lms.ts) and holds a
// pool of multiple-choice questions. At runtime the quiz engine randomizes both
// the question order and the answer order, presents QUIZ_QUESTION_COUNT
// questions, scores against QUIZ_PASS_PERCENT and limits learners to
// QUIZ_MAX_ATTEMPTS. Add new banks here (or extend existing ones) to expand the
// question pool — no other code changes are required.
// ============================================================================

export const QUIZ_PASS_PERCENT = 70;
export const QUIZ_MAX_ATTEMPTS = 3;
/** Number of questions presented per attempt (drawn from the bank). */
export const QUIZ_QUESTION_COUNT = 10;

/**
 * Per-assessment runtime configuration. Module quizzes use the defaults; the
 * standalone Pre-Test, Post-Test and Final Examination override count, attempts,
 * pass mark and (for the exam) a time limit.
 */
export type AssessmentConfig = {
  /** Questions presented per attempt. */
  count: number;
  /** Maximum attempts allowed. */
  maxAttempts: number;
  /** Pass mark percentage (0 = no pass mark, e.g. the Pre-Test). */
  passPercent: number;
  /** Optional time limit in minutes (auto-submits when it reaches zero). */
  timeLimitMin?: number;
  /** Hide PASS/FAIL and show "Completed" instead (Pre-Test). */
  noPassMark?: boolean;
  /** Header label shown in the quiz modal. */
  label?: string;
};

export const ASSESSMENT_CONFIG: Record<string, AssessmentConfig> = {
  preTest: { count: 20, maxAttempts: 1, passPercent: 0, noPassMark: true, label: "Pre-Test" },
  postTest: { count: 20, maxAttempts: 3, passPercent: 70, label: "Post-Test" },
  finalExam: { count: 30, maxAttempts: 2, passPercent: 70, timeLimitMin: 45, label: "Final Examination" },
};

/** Returns the runtime config for an assessment/module id (module default if none). */
export function getAssessmentConfig(id: string): AssessmentConfig {
  return (
    ASSESSMENT_CONFIG[id] ?? {
      count: QUIZ_QUESTION_COUNT,
      maxAttempts: QUIZ_MAX_ATTEMPTS,
      passPercent: QUIZ_PASS_PERCENT,
    }
  );
}

export type QuizQuestion = {
  id: string;
  prompt: string;
  /** Answer choices. The correct one is options[correctIndex]. */
  options: string[];
  correctIndex: number;
};

export type QuizBank = {
  /** LMS module id this bank belongs to (e.g. "m1"). */
  moduleId: string;
  title: string;
  questions: QuizQuestion[];
};

// Helper: build a question where the correct answer is at a known index.
function q(id: string, prompt: string, options: string[], correctIndex: number): QuizQuestion {
  return { id, prompt, options, correctIndex };
}

export const QUIZ_BANKS: QuizBank[] = [
  {
    moduleId: "preTest",
    title: "Pre-Test — Baseline Knowledge Assessment",
    questions: [
      q("pre-q1", "What does aquaculture refer to?", [
        "Catching wild fish only",
        "Farming of fish and other aquatic organisms",
        "Selling imported seafood",
        "Building fishing boats",
      ], 1),
      q("pre-q2", "Which of the following is a freshwater fish commonly farmed?", [
        "Tuna",
        "Tilapia",
        "Cod",
        "Mackerel",
      ], 1),
      q("pre-q3", "Dissolved oxygen in a pond is mainly important because it:", [
        "Colors the water",
        "Allows fish to breathe",
        "Increases salinity",
        "Reduces feeding",
      ], 1),
      q("pre-q4", "What is fingerling in fish farming?", [
        "An adult fish",
        "A young fish at the early grow-out stage",
        "A type of feed",
        "A fishing net",
      ], 1),
      q("pre-q5", "Which factor most affects fish growth?", [
        "Pond color",
        "Feed quality and water quality",
        "Fence height",
        "Road access",
      ], 1),
      q("pre-q6", "Biofloc technology is mainly used to:", [
        "Increase water exchange",
        "Improve water quality and nutrient use",
        "Reduce fish survival",
        "Add salt to water",
      ], 1),
      q("pre-q7", "A hatchery is a facility used to:", [
        "Process fish into food",
        "Produce fish eggs, fry and fingerlings",
        "Sell fishing equipment",
        "Store frozen fish",
      ], 1),
      q("pre-q8", "What is broodstock?", [
        "Mature fish kept for breeding",
        "Fish feed pellets",
        "Diseased fish",
        "Water pumps",
      ], 0),
      q("pre-q9", "Overfeeding fish in a pond can cause:", [
        "Better water quality",
        "Water pollution and low oxygen",
        "Faster growth always",
        "No effect",
      ], 1),
      q("pre-q10", "Which is a value-added fish product?", [
        "Live fish",
        "Fish floss (abon)",
        "Pond water",
        "Fishing rod",
      ], 1),
      q("pre-q11", "Stocking density refers to:", [
        "Number of ponds owned",
        "Number of fish per unit area or volume",
        "Amount of feed per day",
        "Number of workers",
      ], 1),
      q("pre-q12", "Vaccination of fish helps to:", [
        "Increase salinity",
        "Prevent disease",
        "Add color",
        "Reduce growth",
      ], 1),
      q("pre-q13", "The C/N ratio in biofloc systems refers to:", [
        "Calcium to nitrogen",
        "Carbon to nitrogen",
        "Chlorine to nitrate",
        "Carbon to oxygen",
      ], 1),
      q("pre-q14", "Aeration in fish ponds is used to:", [
        "Lower oxygen",
        "Supply and maintain oxygen",
        "Increase ammonia",
        "Reduce circulation",
      ], 1),
      q("pre-q15", "Black Soldier Fly larvae (maggots) are valued in feed for their:", [
        "High protein content",
        "High sugar content",
        "Salt content",
        "Lack of nutrients",
      ], 0),
      q("pre-q16", "Which is a sign of poor water quality?", [
        "Clear, well-oxygenated water",
        "Fish gasping at the surface",
        "Active feeding",
        "Stable temperature",
      ], 1),
      q("pre-q17", "Maggot meal can partially replace which expensive feed ingredient?", [
        "Sand",
        "Fish meal",
        "Lime",
        "Gravel",
      ], 1),
      q("pre-q18", "Catfish are well suited to intensive culture because they:", [
        "Cannot tolerate crowding",
        "Tolerate high stocking densities",
        "Require seawater",
        "Do not eat feed",
      ], 1),
      q("pre-q19", "Fish bone flour is a good source of:", [
        "Calcium",
        "Alcohol",
        "Sugar",
        "Salt",
      ], 0),
      q("pre-q20", "Why is record-keeping important in fish farming?", [
        "It is not important",
        "To track growth, feeding and improve management",
        "To increase mortality",
        "To raise water temperature",
      ], 1),
    ],
  },
  {
    moduleId: "m1",
    title: "Preparing Biofloc Containers and Media",
    questions: [
      q("m1-q1", "What is the primary purpose of biofloc technology?", [
        "Increase water salinity",
        "Improve water quality and nutrient utilization",
        "Reduce fish growth",
        "Increase pond temperature",
      ], 1),
      q("m1-q2", "Which microorganism is primarily responsible for biofloc formation?", [
        "Tilapia",
        "Catfish",
        "Heterotrophic bacteria",
        "Algae",
      ], 2),
      q("m1-q3", "What is commonly used as a carbon source in biofloc systems?", [
        "Salt",
        "Molasses",
        "Sand",
        "Gravel",
      ], 1),
      q("m1-q4", "Why is continuous aeration important in biofloc culture?", [
        "To increase water temperature",
        "To maintain oxygen levels and keep flocs suspended",
        "To reduce fish feeding",
        "To increase salinity",
      ], 1),
      q("m1-q5", "Before stocking fish, the biofloc medium should be:", [
        "Completely drained",
        "Activated with probiotics and bacteria",
        "Mixed with antibiotics",
        "Filled with harvested fish",
      ], 1),
      q("m1-q6", "What is one advantage of biofloc technology?", [
        "Higher water exchange requirement",
        "Improved feed efficiency",
        "Increased disease outbreaks",
        "Lower fish survival",
      ], 1),
      q("m1-q7", "Which water parameter should be monitored regularly in biofloc systems?", [
        "Wind speed",
        "Dissolved oxygen",
        "Cloud cover",
        "Soil type",
      ], 1),
      q("m1-q8", "Biofloc particles can serve as:", [
        "Waste only",
        "Supplemental natural feed",
        "Water contaminants",
        "Pond fertilizer only",
      ], 1),
      q("m1-q9", "What happens if aeration stops for an extended period?", [
        "Floc remains stable",
        "Oxygen levels decline and fish may be stressed",
        "Fish grow faster",
        "Water becomes cleaner",
      ], 1),
      q("m1-q10", "Which stage comes first when preparing a biofloc system?", [
        "Harvesting fish",
        "Pond preparation and water conditioning",
        "Packaging fish",
        "Marketing fish",
      ], 1),
    ],
  },
  {
    moduleId: "m2",
    title: "Preparation of Biofloc Pond Media",
    questions: [
      q("m2-q1", "What is the main goal when preparing biofloc pond media?", [
        "Increase water salinity",
        "Establish a healthy microbial community",
        "Reduce dissolved oxygen",
        "Lower water temperature",
      ], 1),
      q("m2-q2", "Which ratio is most important to manage in biofloc pond media?", [
        "Carbon to nitrogen (C/N) ratio",
        "Salt to water ratio",
        "Sand to gravel ratio",
        "Light to shade ratio",
      ], 0),
      q("m2-q3", "What is commonly added to raise the carbon level in the media?", [
        "Lime only",
        "A carbon source such as molasses",
        "Antibiotics",
        "Table salt",
      ], 1),
      q("m2-q4", "Probiotic inoculation in pond media is used to:", [
        "Kill all bacteria",
        "Introduce beneficial microorganisms",
        "Increase turbidity permanently",
        "Reduce oxygen demand",
      ], 1),
      q("m2-q5", "Floc development is typically monitored using a:", [
        "Imhoff cone (floc volume)",
        "Thermometer only",
        "Wind gauge",
        "Light meter",
      ], 0),
      q("m2-q6", "Why is continuous aeration required during media preparation?", [
        "To keep flocs suspended and supply oxygen",
        "To increase salinity",
        "To cool the water rapidly",
        "To stop microbial growth",
      ], 0),
      q("m2-q7", "An ideal C/N ratio for biofloc development is approximately:", [
        "1:1",
        "5:1",
        "10–20:1",
        "100:1",
      ], 2),
      q("m2-q8", "What indicates that the media is ready for stocking?", [
        "Stable floc volume and good water parameters",
        "Complete absence of bacteria",
        "Very high ammonia levels",
        "Zero dissolved oxygen",
      ], 0),
      q("m2-q9", "Excess organic carbon without monitoring can cause:", [
        "Oxygen depletion",
        "Improved clarity only",
        "Permanent floc stability",
        "Higher salinity",
      ], 0),
      q("m2-q10", "The beneficial bacteria in biofloc help convert toxic ammonia into:", [
        "Microbial biomass",
        "Pure oxygen",
        "Salt",
        "Carbon dioxide only",
      ], 0),
    ],
  },
  {
    moduleId: "m3",
    title: "Catfish Hatchery and Seed Management",
    questions: [
      q("m3-q1", "What is the first step in hatchery management?", [
        "Harvesting",
        "Broodstock selection",
        "Packaging",
        "Marketing",
      ], 1),
      q("m3-q2", "A good broodstock should be:", [
        "Injured",
        "Diseased",
        "Healthy and sexually mature",
        "Undersized",
      ], 2),
      q("m3-q3", "What is the function of kakaban?", [
        "Fish feed",
        "Egg attachment substrate",
        "Water filter",
        "Fish shelter",
      ], 1),
      q("m3-q4", "Induced spawning commonly uses:", [
        "Vaccines",
        "Hormone injections",
        "Salt treatment",
        "Lime",
      ], 1),
      q("m3-q5", "The goal of seed management is:", [
        "Increase mortality",
        "Produce healthy and uniform fry",
        "Reduce growth",
        "Increase feed waste",
      ], 1),
      q("m3-q6", "What is fertilization in fish breeding?", [
        "Feeding broodstock",
        "Fusion of sperm and egg cells",
        "Harvesting larvae",
        "Packaging fry",
      ], 1),
      q("m3-q7", "Why is water quality important in hatcheries?", [
        "Improves building appearance",
        "Supports egg and larval survival",
        "Reduces labor requirements",
        "Increases pond size",
      ], 1),
      q("m3-q8", "What should be done after hatching?", [
        "Immediate harvesting",
        "Larval nursing and feeding management",
        "Drying the pond",
        "Selling larvae",
      ], 1),
      q("m3-q9", "Which factor most affects fry survival?", [
        "Water quality",
        "Pond color",
        "Building design",
        "Fence height",
      ], 0),
      q("m3-q10", "The main purpose of hatchery operations is:", [
        "Produce quality fish seed",
        "Produce fish feed",
        "Produce fertilizer",
        "Produce equipment",
      ], 0),
    ],
  },
  {
    moduleId: "m4",
    title: "Catfish Aquaculture",
    questions: [
      q("m4-q1", "What is the most important factor for catfish production?", [
        "Feed management",
        "Pond color",
        "Weather forecast",
        "Marketing",
      ], 0),
      q("m4-q2", "Biofloc technology converts ammonia into:", [
        "Oxygen",
        "Microbial biomass",
        "Salt",
        "Heat",
      ], 1),
      q("m4-q3", "Poor aeration can result in:", [
        "Higher oxygen levels",
        "Uneven oxygen distribution",
        "Faster fish growth",
        "Lower feed costs",
      ], 1),
      q("m4-q4", "Excessive floc accumulation may:", [
        "Cause management problems",
        "Improve harvesting",
        "Reduce feeding needs completely",
        "Increase fish size immediately",
      ], 0),
      q("m4-q5", "Disease prevention is important because it:", [
        "Improves profits and reduces losses",
        "Reduces fish size",
        "Increases mortality",
        "Delays production",
      ], 0),
      q("m4-q6", "Which parameter should be monitored daily?", [
        "Dissolved oxygen",
        "Building height",
        "Road access",
        "Pond color",
      ], 0),
      q("m4-q7", "Good feeding management helps:", [
        "Increase feed waste",
        "Improve fish growth",
        "Reduce water quality",
        "Increase disease",
      ], 1),
      q("m4-q8", "What is stocking density?", [
        "Number of fish per unit area or volume",
        "Number of ponds",
        "Number of workers",
        "Number of feed bags",
      ], 0),
      q("m4-q9", "Harvest planning is important to:", [
        "Optimize production and market timing",
        "Reduce fish quality",
        "Increase mortality",
        "Delay sales",
      ], 0),
      q("m4-q10", "The primary goal of catfish aquaculture is:", [
        "Efficient and sustainable fish production",
        "Producing fish waste",
        "Increasing pond depth",
        "Reducing fish growth",
      ], 0),
    ],
  },
  {
    moduleId: "m5",
    title: "Making Catfish Feed from Maggot",
    questions: [
      q("m5-q1", "Which insect produces maggot meal used in aquaculture feed?", [
        "Mosquito",
        "Black Soldier Fly",
        "Butterfly",
        "Dragonfly",
      ], 1),
      q("m5-q2", "Why is maggot meal valuable as feed?", [
        "High protein content",
        "High salt content",
        "High moisture content",
        "High sugar content",
      ], 0),
      q("m5-q3", "Feed costs can represent approximately:", [
        "10–20%",
        "20–30%",
        "60–70%",
        "90–100%",
      ], 2),
      q("m5-q4", "Which step occurs before feed molding?", [
        "Packaging",
        "Ingredient mixing",
        "Marketing",
        "Harvesting",
      ], 1),
      q("m5-q5", "What is the purpose of feed quality testing?", [
        "Evaluate feed performance and quality",
        "Improve packaging design",
        "Increase feed color",
        "Reduce feed production",
      ], 0),
      q("m5-q6", "Black Soldier Fly larvae are rich in:", [
        "Protein and fat",
        "Sugar and salt",
        "Vitamins only",
        "Water only",
      ], 0),
      q("m5-q7", "Maggot meal can partially replace:", [
        "Fish meal",
        "Sand",
        "Gravel",
        "Fertilizer",
      ], 0),
      q("m5-q8", "What is one advantage of maggot production?", [
        "Utilizes organic waste",
        "Requires expensive equipment only",
        "Produces no nutrients",
        "Reduces feed quality",
      ], 0),
      q("m5-q9", "After molding, feed is generally:", [
        "Burned",
        "Dried",
        "Frozen immediately",
        "Discarded",
      ], 1),
      q("m5-q10", "The main objective of maggot-based feed production is:", [
        "Produce affordable and nutritious fish feed",
        "Increase feed waste",
        "Reduce fish growth",
        "Increase water pollution",
      ], 0),
    ],
  },
  {
    moduleId: "m6",
    title: "Tilapia Hatchery and Management",
    questions: [
      q("m6-q1", "What is the primary objective of tilapia hatchery management?", [
        "Produce market-size fish",
        "Produce healthy fry and fingerlings",
        "Produce fish feed",
        "Produce fertilizer",
      ], 1),
      q("m6-q2", "Which characteristic is important when selecting tilapia broodstock?", [
        "Diseased fish",
        "Healthy and mature fish",
        "Small fish only",
        "Fish with deformities",
      ], 1),
      q("m6-q3", "Tilapia reproduction generally occurs through:", [
        "External fertilization",
        "Mouthbrooding behavior",
        "Egg injection",
        "Artificial incubation only",
      ], 1),
      q("m6-q4", "Why is broodstock nutrition important?", [
        "Improves pond color",
        "Supports reproductive performance",
        "Reduces oxygen levels",
        "Increases water turbidity",
      ], 1),
      q("m6-q5", "What is the ideal outcome of hatchery operations?", [
        "High mortality",
        "Uniform and healthy seed production",
        "Delayed spawning",
        "Reduced growth",
      ], 1),
      q("m6-q6", "Which factor most influences egg hatchability?", [
        "Water quality",
        "Pond paint color",
        "Fence height",
        "Harvest equipment",
      ], 0),
      q("m6-q7", "What is a common indicator of healthy fry?", [
        "Active swimming behavior",
        "Floating upside down",
        "Irregular movement",
        "No feeding response",
      ], 0),
      q("m6-q8", "Nursery management aims to:", [
        "Improve fingerling survival and growth",
        "Reduce stocking density",
        "Increase mortality",
        "Delay feeding",
      ], 0),
      q("m6-q9", "What should be monitored during hatchery operations?", [
        "Dissolved oxygen and temperature",
        "Building design",
        "Market price only",
        "Transportation schedule",
      ], 0),
      q("m6-q10", "Successful hatchery management results in:", [
        "Quality fingerlings for grow-out systems",
        "Reduced fish production",
        "Increased disease outbreaks",
        "Lower survival rates",
      ], 0),
    ],
  },
  {
    moduleId: "m7",
    title: "Tilapia Cultivation Using Biofloc System",
    questions: [
      q("m7-q1", "What is the main benefit of biofloc in tilapia culture?", [
        "Higher water exchange",
        "Improved feed utilization",
        "Increased salinity",
        "Reduced fish growth",
      ], 1),
      q("m7-q2", "Biofloc technology helps reduce:", [
        "Nitrogen waste accumulation",
        "Fish feeding activity",
        "Water temperature",
        "Fish survival",
      ], 0),
      q("m7-q3", "Which component is essential for biofloc formation?", [
        "Carbon source",
        "Sand",
        "Gravel",
        "Clay",
      ], 0),
      q("m7-q4", "Why are tilapia suitable for biofloc systems?", [
        "They tolerate variable water conditions",
        "They require seawater",
        "They do not eat microorganisms",
        "They grow only in rivers",
      ], 0),
      q("m7-q5", "Continuous aeration is needed to:", [
        "Keep flocs suspended",
        "Increase sunlight",
        "Lower oxygen",
        "Increase salinity",
      ], 0),
      q("m7-q6", "What is one nutritional advantage of biofloc?", [
        "Additional protein source",
        "Reduced nutrient availability",
        "Increased waste",
        "Lower feed efficiency",
      ], 0),
      q("m7-q7", "Excessive biofloc accumulation may:", [
        "Create management challenges",
        "Improve harvesting automatically",
        "Eliminate feeding",
        "Reduce oxygen demand",
      ], 0),
      q("m7-q8", "Which water parameter is critical in biofloc culture?", [
        "Dissolved oxygen",
        "Building height",
        "Wind direction",
        "Road condition",
      ], 0),
      q("m7-q9", "Biofloc microorganisms convert waste into:", [
        "Nutrient-rich biomass",
        "Salt",
        "Sand",
        "Lime",
      ], 0),
      q("m7-q10", "The primary goal of biofloc culture is:", [
        "Sustainable and efficient fish production",
        "Higher waste generation",
        "Reduced fish growth",
        "Increased water replacement",
      ], 0),
    ],
  },
  {
    moduleId: "m8",
    title: "Vaccine and Vaccination in Tilapia Farming",
    questions: [
      q("m8-q1", "What is the primary purpose of vaccination?", [
        "Improve fish color",
        "Prevent disease outbreaks",
        "Increase pond depth",
        "Reduce feeding",
      ], 1),
      q("m8-q2", "Vaccines work by:", [
        "Stimulating the immune system",
        "Increasing salinity",
        "Reducing oxygen",
        "Accelerating harvesting",
      ], 0),
      q("m8-q3", "Which fish health issue can vaccination help reduce?", [
        "Infectious diseases",
        "Water evaporation",
        "Feed cost",
        "Pond leakage",
      ], 0),
      q("m8-q4", "Vaccination contributes to:", [
        "Better survival rates",
        "Higher mortality",
        "Lower growth",
        "Increased stress",
      ], 0),
      q("m8-q5", "What should be considered before vaccination?", [
        "Fish health status",
        "Pond color",
        "Building design",
        "Market demand",
      ], 0),
      q("m8-q6", "Which vaccination method is commonly used in aquaculture?", [
        "Injection",
        "Painting",
        "Smoking",
        "Drying",
      ], 0),
      q("m8-q7", "Vaccination is most effective when:", [
        "Fish are healthy",
        "Fish are severely diseased",
        "Oxygen is absent",
        "Feed is unavailable",
      ], 0),
      q("m8-q8", "What is an expected outcome of successful vaccination?", [
        "Reduced disease incidence",
        "Increased mortality",
        "Slower growth",
        "Lower survival",
      ], 0),
      q("m8-q9", "Vaccination is part of:", [
        "Fish health management",
        "Feed manufacturing",
        "Pond construction",
        "Fish marketing",
      ], 0),
      q("m8-q10", "Biosecurity and vaccination together help:", [
        "Improve disease prevention",
        "Increase disease spread",
        "Reduce water quality",
        "Delay production",
      ], 0),
    ],
  },
  {
    moduleId: "m9",
    title: "Making Tilapia Feed from Maggot",
    questions: [
      q("m9-q1", "Which insect species is commonly used for maggot production?", [
        "Black Soldier Fly",
        "Mosquito",
        "Butterfly",
        "Dragonfly",
      ], 0),
      q("m9-q2", "Maggot meal is valued because it contains:", [
        "High protein",
        "High sugar",
        "High salt",
        "High moisture only",
      ], 0),
      q("m9-q3", "One benefit of maggot meal is:", [
        "Partial replacement of fish meal",
        "Increased feed cost",
        "Reduced nutrition",
        "Lower digestibility",
      ], 0),
      q("m9-q4", "Maggot production supports:", [
        "Organic waste utilization",
        "Increased pollution",
        "Reduced sustainability",
        "Higher waste disposal",
      ], 0),
      q("m9-q5", "Which nutrient is abundant in maggot meal?", [
        "Protein",
        "Alcohol",
        "Fiber only",
        "Ash only",
      ], 0),
      q("m9-q6", "Why is feed formulation important?", [
        "To meet fish nutritional requirements",
        "To increase waste",
        "To reduce growth",
        "To increase disease",
      ], 0),
      q("m9-q7", "What is the purpose of feed mixing?", [
        "Achieve uniform nutrient distribution",
        "Improve pond color",
        "Reduce aeration",
        "Increase water exchange",
      ], 0),
      q("m9-q8", "What step follows feed molding?", [
        "Drying",
        "Harvesting",
        "Packaging fish",
        "Vaccination",
      ], 0),
      q("m9-q9", "Feed quality testing evaluates:", [
        "Nutritional and physical quality",
        "Building design",
        "Market demand",
        "Water depth",
      ], 0),
      q("m9-q10", "The main goal of maggot-based feed production is:", [
        "Affordable and sustainable feed production",
        "Higher waste generation",
        "Lower fish performance",
        "Reduced feed availability",
      ], 0),
    ],
  },
  {
    moduleId: "m10",
    title: "Making Catfish Floss",
    questions: [
      q("m10-q1", "What is catfish floss?", [
        "Fresh fish product",
        "A value-added processed fish product",
        "Fish feed ingredient",
        "Fish vaccine",
      ], 1),
      q("m10-q2", "The primary purpose of making catfish floss is:", [
        "Increase fish mortality",
        "Extend shelf life and increase product value",
        "Reduce fish consumption",
        "Improve pond management",
      ], 1),
      q("m10-q3", "Which nutrient is abundant in catfish?", [
        "Protein",
        "Alcohol",
        "Sugar",
        "Starch",
      ], 0),
      q("m10-q4", "One advantage of fish processing is:", [
        "Reduced market opportunities",
        "Increased economic value",
        "Reduced product diversity",
        "Lower consumer acceptance",
      ], 1),
      q("m10-q5", "Which process is commonly involved in making fish floss?", [
        "Frying",
        "Vaccination",
        "Aeration",
        "Liming",
      ], 0),
      q("m10-q6", "Why is moisture reduction important?", [
        "Improve spoilage",
        "Extend shelf life",
        "Increase disease",
        "Reduce flavor",
      ], 1),
      q("m10-q7", "Fish floss is popular because of its:", [
        "Texture and flavor",
        "Pond color",
        "Water quality",
        "Salinity",
      ], 0),
      q("m10-q8", "The quality of fish floss depends largely on:", [
        "Raw material quality",
        "Pond size",
        "Feed price",
        "Weather forecast",
      ], 0),
      q("m10-q9", "Proper packaging helps:", [
        "Maintain product quality",
        "Reduce product value",
        "Increase spoilage",
        "Eliminate flavor",
      ], 0),
      q("m10-q10", "Fish floss production supports:", [
        "Product diversification",
        "Fish mortality",
        "Water pollution",
        "Reduced entrepreneurship",
      ], 0),
    ],
  },
  {
    moduleId: "m11",
    title: "Fishbone Cookies",
    questions: [
      q("m11-q1", "What is the primary ingredient that distinguishes fishbone cookies from regular cookies?", [
        "Rice flour",
        "Fish bone meal",
        "Corn flour",
        "Tapioca flour",
      ], 1),
      q("m11-q2", "Fish bone meal is valued because it contains:", [
        "Calcium and minerals",
        "Alcohol",
        "High sugar",
        "Salt only",
      ], 0),
      q("m11-q3", "Fishbone cookies are considered:", [
        "A value-added fisheries product",
        "Fresh fish product",
        "Fish feed",
        "Hatchery equipment",
      ], 0),
      q("m11-q4", "Which process comes before baking?", [
        "Mixing and molding",
        "Harvesting",
        "Aeration",
        "Vaccination",
      ], 0),
      q("m11-q5", "Fishbone cookies are expected to have:", [
        "Crunchy texture",
        "Liquid consistency",
        "High moisture",
        "Bitter taste",
      ], 0),
      q("m11-q6", "Why is fish bone utilization important?", [
        "Reduce waste and increase value",
        "Increase waste generation",
        "Reduce product diversity",
        "Lower nutritional value",
      ], 0),
      q("m11-q7", "The shelf life of fishbone cookies depends largely on:", [
        "Moisture content",
        "Pond depth",
        "Fish species",
        "Water salinity",
      ], 0),
      q("m11-q8", "Proper packaging helps:", [
        "Preserve product quality",
        "Increase spoilage",
        "Reduce shelf life",
        "Lower product value",
      ], 0),
      q("m11-q9", "Fishbone cookies can contribute to:", [
        "Nutritional diversification",
        "Reduced nutrition",
        "Lower consumer interest",
        "Reduced calcium intake",
      ], 0),
      q("m11-q10", "The main objective of fishbone cookie production is:", [
        "Develop nutritious fisheries-based snacks",
        "Produce fish feed",
        "Reduce food innovation",
        "Increase waste",
      ], 0),
    ],
  },
  {
    moduleId: "m12",
    title: "Processing Method of Fish Stick Cheese",
    questions: [
      q("m12-q1", "Fish stick cheese is categorized as:", [
        "Value-added fish product",
        "Fish feed",
        "Vaccine product",
        "Hatchery equipment",
      ], 0),
      q("m12-q2", "Fish is considered a nutritious food because it contains:", [
        "High-quality protein",
        "Alcohol",
        "Excessive sugar",
        "Artificial preservatives",
      ], 0),
      q("m12-q3", "One objective of fish processing is:", [
        "Increase economic value",
        "Reduce product quality",
        "Increase spoilage",
        "Reduce marketability",
      ], 0),
      q("m12-q4", "Fish stick cheese combines fish with:", [
        "Cheese",
        "Soil",
        "Sand",
        "Fertilizer",
      ], 0),
      q("m12-q5", "Product diversification helps:", [
        "Expand market opportunities",
        "Reduce consumer choice",
        "Lower profitability",
        "Reduce innovation",
      ], 0),
      q("m12-q6", "Quality control is important to:", [
        "Maintain product safety and quality",
        "Increase spoilage",
        "Reduce shelf life",
        "Eliminate packaging",
      ], 0),
      q("m12-q7", "Packaging serves to:", [
        "Protect the product",
        "Increase contamination",
        "Reduce shelf life",
        "Lower value",
      ], 0),
      q("m12-q8", "Fish stick cheese production supports:", [
        "Fisheries entrepreneurship",
        "Fish mortality",
        "Water pollution",
        "Reduced product diversity",
      ], 0),
      q("m12-q9", "Food safety is important because:", [
        "Consumers must receive safe products",
        "It reduces quality",
        "It reduces nutrition",
        "It decreases demand",
      ], 0),
      q("m12-q10", "The primary goal of fish stick cheese production is:", [
        "Create innovative fish-based food products",
        "Produce fish feed",
        "Reduce fish consumption",
        "Increase waste",
      ], 0),
    ],
  },
  {
    moduleId: "m13",
    title: "Fish Bone Churros Making Technique",
    questions: [
      q("m13-q1", "Fish bone churros are an example of:", [
        "Product innovation",
        "Fish feed",
        "Hatchery technology",
        "Vaccination method",
      ], 0),
      q("m13-q2", "Fish bone flour is rich in:", [
        "Calcium and minerals",
        "Alcohol",
        "Sugar",
        "Salt only",
      ], 0),
      q("m13-q3", "Churros are traditionally made from:", [
        "Choux dough",
        "Pond sludge",
        "Fish feed",
        "Probiotics",
      ], 0),
      q("m13-q4", "One reason for utilizing fish bones is:", [
        "Reduce processing waste",
        "Increase waste generation",
        "Reduce product value",
        "Eliminate innovation",
      ], 0),
      q("m13-q5", "Fish bone churros contribute to:", [
        "Product diversification",
        "Reduced food variety",
        "Lower nutritional value",
        "Reduced entrepreneurship",
      ], 0),
      q("m13-q6", "Which step is part of churros production?", [
        "Frying",
        "Vaccination",
        "Aeration",
        "Liming",
      ], 0),
      q("m13-q7", "Proper packaging helps:", [
        "Preserve quality",
        "Increase spoilage",
        "Reduce shelf life",
        "Lower consumer acceptance",
      ], 0),
      q("m13-q8", "Fish bone flour adds:", [
        "Nutritional value",
        "Toxic compounds",
        "Excessive moisture",
        "Water contamination",
      ], 0),
      q("m13-q9", "Product innovation helps:", [
        "Meet changing consumer demands",
        "Reduce market opportunities",
        "Lower competitiveness",
        "Reduce product quality",
      ], 0),
      q("m13-q10", "The main purpose of fish bone churros production is:", [
        "Create nutritious value-added products",
        "Produce fish feed",
        "Reduce fish processing",
        "Increase waste",
      ], 0),
    ],
  },
  {
    moduleId: "postTest",
    title: "Final Integrated Quiz",
    questions: [
      q("post-q1", "What is the primary objective of biofloc technology?", [
        "Improve water quality and nutrient efficiency",
        "Increase salinity",
        "Reduce fish growth",
        "Eliminate feeding",
      ], 0),
      q("post-q2", "Which species is commonly cultured using biofloc technology in this training?", [
        "Tilapia and Catfish",
        "Tuna and Marlin",
        "Salmon and Trout",
        "Crab and Lobster",
      ], 0),
      q("post-q3", "What is the purpose of broodstock selection?", [
        "Produce healthy offspring",
        "Reduce hatchability",
        "Increase mortality",
        "Reduce growth",
      ], 0),
      q("post-q4", "What is the main benefit of maggot meal?", [
        "Alternative protein source",
        "High sugar content",
        "High salt content",
        "No nutritional value",
      ], 0),
      q("post-q5", "Vaccination is used primarily to:", [
        "Prevent disease",
        "Increase salinity",
        "Improve pond design",
        "Reduce oxygen",
      ], 0),
      q("post-q6", "Fish processing creates:", [
        "Added value products",
        "Less market opportunity",
        "Lower nutrition",
        "Reduced entrepreneurship",
      ], 0),
      q("post-q7", "Fish bone flour is rich in:", [
        "Calcium",
        "Alcohol",
        "Sugar",
        "Salt",
      ], 0),
      q("post-q8", "Sustainable aquaculture requires:", [
        "Good management practices",
        "Poor water quality",
        "Excessive stocking",
        "No monitoring",
      ], 0),
      q("post-q9", "Entrepreneurship opportunities can arise from:", [
        "Value-added fisheries products",
        "Waste disposal only",
        "Pond construction only",
        "Water exchange only",
      ], 0),
      q("post-q10", "The overall goal of this training is:", [
        "Strengthen fisheries and aquaculture capacity in African countries",
        "Promote fish imports",
        "Reduce aquaculture production",
        "Eliminate fisheries development",
      ], 0),
      q("post-q11", "An adequate C/N ratio for biofloc development is approximately:", [
        "1:1",
        "10–20:1",
        "100:1",
        "0.5:1",
      ], 1),
      q("post-q12", "Induced spawning in catfish is typically achieved using:", [
        "Hormone injection",
        "Salt baths",
        "Vaccination",
        "Liming",
      ], 0),
      q("post-q13", "Which is the most critical daily parameter to monitor in intensive culture?", [
        "Dissolved oxygen",
        "Pond paint color",
        "Wind direction",
        "Market price",
      ], 0),
      q("post-q14", "Kakaban is used in catfish hatcheries as a(n):", [
        "Egg attachment substrate",
        "Feed additive",
        "Water filter",
        "Disease treatment",
      ], 0),
      q("post-q15", "Tilapia reproduce mainly through:", [
        "Mouthbrooding",
        "Live birth",
        "Artificial cloning",
        "Budding",
      ], 0),
      q("post-q16", "A key biosecurity practice in fish farming is:", [
        "Disinfecting equipment and controlling access",
        "Sharing nets between ponds freely",
        "Skipping water testing",
        "Overstocking ponds",
      ], 0),
      q("post-q17", "Pelletized fish feed is usually dried in order to:", [
        "Extend shelf life and reduce spoilage",
        "Increase moisture",
        "Add salt",
        "Reduce protein",
      ], 0),
      q("post-q18", "Floc volume in a biofloc pond is commonly measured with a(n):", [
        "Imhoff cone",
        "Thermometer",
        "Light meter",
        "Wind gauge",
      ], 0),
      q("post-q19", "Value-added processing of fish primarily helps to:", [
        "Increase product value and shelf life",
        "Lower nutritional value",
        "Reduce market options",
        "Waste raw material",
      ], 0),
      q("post-q20", "Sustainable aquaculture depends most on:", [
        "Good management and water quality control",
        "Maximum stocking with no monitoring",
        "Avoiding all record-keeping",
        "Frequent total water changes only",
      ], 0),
    ],
  },
  {
    moduleId: "finalExam",
    title: "Final Examination — Comprehensive Assessment",
    questions: [
      q("fin-q1", "The primary purpose of biofloc technology is to:", [
        "Improve water quality and nutrient utilization",
        "Increase salinity",
        "Reduce fish growth",
        "Eliminate aeration",
      ], 0),
      q("fin-q2", "Which microorganisms drive biofloc formation?", [
        "Heterotrophic bacteria",
        "Tilapia",
        "Algae only",
        "Catfish",
      ], 0),
      q("fin-q3", "A common carbon source added to biofloc systems is:", [
        "Molasses",
        "Salt",
        "Sand",
        "Gravel",
      ], 0),
      q("fin-q4", "Continuous aeration is required mainly to:", [
        "Keep flocs suspended and supply oxygen",
        "Increase water temperature",
        "Raise salinity",
        "Stop microbial growth",
      ], 0),
      q("fin-q5", "The ideal C/N ratio for biofloc development is around:", [
        "10–20:1",
        "1:1",
        "100:1",
        "0.2:1",
      ], 0),
      q("fin-q6", "The first step in hatchery management is:", [
        "Broodstock selection",
        "Harvesting",
        "Packaging",
        "Marketing",
      ], 0),
      q("fin-q7", "A good broodstock should be:", [
        "Healthy and sexually mature",
        "Diseased",
        "Undersized",
        "Injured",
      ], 0),
      q("fin-q8", "Induced spawning commonly uses:", [
        "Hormone injection",
        "Lime treatment",
        "Salt bath",
        "Vaccines",
      ], 0),
      q("fin-q9", "The main goal of seed management is to:", [
        "Produce healthy, uniform fry",
        "Increase mortality",
        "Reduce growth",
        "Waste feed",
      ], 0),
      q("fin-q10", "The most important factor in catfish grow-out is:", [
        "Feed and water quality management",
        "Pond color",
        "Weather forecasts",
        "Road access",
      ], 0),
      q("fin-q11", "Stocking density is the:", [
        "Number of fish per unit area or volume",
        "Number of ponds",
        "Number of feed bags",
        "Number of staff",
      ], 0),
      q("fin-q12", "Maggot meal used in feed is produced from:", [
        "Black Soldier Fly larvae",
        "Mosquito larvae",
        "Butterflies",
        "Bees",
      ], 0),
      q("fin-q13", "Maggot meal is valuable because it is high in:", [
        "Protein",
        "Sugar",
        "Salt",
        "Water",
      ], 0),
      q("fin-q14", "Feed costs in aquaculture can represent roughly:", [
        "60–70% of production cost",
        "5% of production cost",
        "1% of production cost",
        "100% of revenue",
      ], 0),
      q("fin-q15", "The main objective of tilapia hatchery management is to:", [
        "Produce healthy fry and fingerlings",
        "Produce fertilizer",
        "Produce market-size fish",
        "Produce feed",
      ], 0),
      q("fin-q16", "Tilapia reproduce mainly through:", [
        "Mouthbrooding",
        "External fertilization only",
        "Cloning",
        "Egg injection",
      ], 0),
      q("fin-q17", "Tilapia suit biofloc systems because they:", [
        "Tolerate variable water conditions",
        "Require seawater",
        "Do not feed",
        "Only live in rivers",
      ], 0),
      q("fin-q18", "Biofloc microorganisms convert toxic waste into:", [
        "Nutrient-rich biomass",
        "Salt",
        "Sand",
        "Lime",
      ], 0),
      q("fin-q19", "Vaccination in fish farming is used primarily to:", [
        "Prevent disease",
        "Increase salinity",
        "Reduce oxygen",
        "Add color",
      ], 0),
      q("fin-q20", "A core biosecurity measure is:", [
        "Disinfecting equipment and controlling access",
        "Sharing nets between all ponds",
        "Skipping monitoring",
        "Overstocking",
      ], 0),
      q("fin-q21", "Tilapia feed from maggot meal is dried mainly to:", [
        "Extend shelf life",
        "Add moisture",
        "Increase spoilage",
        "Reduce protein",
      ], 0),
      q("fin-q22", "Catfish floss (abon) is an example of a:", [
        "Value-added processed product",
        "Live fish product",
        "Fish vaccine",
        "Feed ingredient",
      ], 0),
      q("fin-q23", "The main purpose of making catfish floss is to:", [
        "Extend shelf life and increase product value",
        "Increase mortality",
        "Reduce nutrition",
        "Lower income",
      ], 0),
      q("fin-q24", "Fish bone flour is especially rich in:", [
        "Calcium",
        "Alcohol",
        "Sugar",
        "Salt",
      ], 0),
      q("fin-q25", "Fishbone cookies are an example of using fish waste to:", [
        "Create a nutritious value-added product",
        "Pollute water",
        "Reduce calcium intake",
        "Waste resources",
      ], 0),
      q("fin-q26", "A key water quality parameter to monitor daily is:", [
        "Dissolved oxygen",
        "Building height",
        "Wind direction",
        "Market demand",
      ], 0),
      q("fin-q27", "Excessive floc accumulation in a pond can:", [
        "Cause management and oxygen problems",
        "Always improve harvesting",
        "Eliminate feeding needs",
        "Increase fish size instantly",
      ], 0),
      q("fin-q28", "Good feeding management primarily helps to:", [
        "Improve growth and feed efficiency",
        "Increase feed waste",
        "Worsen water quality",
        "Spread disease",
      ], 0),
      q("fin-q29", "Value-added fisheries products create opportunities for:", [
        "Entrepreneurship and higher income",
        "Lower market value",
        "Reduced food security",
        "Waste only",
      ], 0),
      q("fin-q30", "The overall goal of this training is to:", [
        "Strengthen fisheries and aquaculture capacity in African countries",
        "Promote fish imports",
        "Reduce aquaculture output",
        "Discourage fisheries development",
      ], 0),
    ],
  },
];

const BANK_BY_MODULE: Record<string, QuizBank> = Object.fromEntries(
  QUIZ_BANKS.map((b) => [b.moduleId, b]),
);

/** Returns the quiz bank for a module, or undefined if none has been authored. */
export function getQuizBank(moduleId: string): QuizBank | undefined {
  return BANK_BY_MODULE[moduleId];
}

/** True when a module has a quiz bank available. */
export function hasQuizBank(moduleId: string): boolean {
  return moduleId in BANK_BY_MODULE;
}

// ── Runtime helpers (randomization) ──────────────────────────────────────────
export type RunChoice = { text: string; correct: boolean };
export type RunQuestion = {
  id: string;
  prompt: string;
  choices: RunChoice[];
  correctIndex: number;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Builds a randomized attempt: question order shuffled, answer order shuffled,
 * and limited to `count` questions (defaults to QUIZ_QUESTION_COUNT).
 */
export function buildAttempt(bank: QuizBank, count: number = QUIZ_QUESTION_COUNT): RunQuestion[] {
  const picked = shuffle(bank.questions).slice(0, count);

  return picked.map((question) => {
    const choices = shuffle(
      question.options.map((text, i) => ({ text, correct: i === question.correctIndex })),
    );
    return {
      id: question.id,
      prompt: question.prompt,
      choices,
      correctIndex: choices.findIndex((c) => c.correct),
    };
  });
}
