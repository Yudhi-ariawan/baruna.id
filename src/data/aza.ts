// ============================================================================
// BARUNA Academy — Allocated Zones for Aquaculture (AZA)
// Fully online, individual self-paced training. Single source of truth for
// the course card, detail page, learning workspace and certificate.
// ============================================================================

import { academyImages } from "@/data/academy";

export const AZA_COURSE_ID = "tr-09";
export const AZA_SLUG = "allocated-zones-for-aquaculture";
export const AZA_LEARN_ID = "allocated-zones-for-aquaculture";
export const AZA_ACCESS_DAYS = 30;
export const AZA_PASS_MARK = 70;

export const AZA_META = {
  title: "Allocated Zones for Aquaculture",
  fullTitle:
    "Allocated Zones for Aquaculture: Planning Sustainable Aquaculture through Marine Spatial Planning",
  subtitle: "A Practical Individual Training Based on the FAO–GFCM AZA Approach",
  tagline: "Plan the Space. Protect the Ecosystem. Sustain Aquaculture.",
  shortDescription:
    "Learn independently how to identify, assess, and plan priority areas for sustainable aquaculture using Marine Spatial Planning, multi-criteria analysis, stakeholder considerations, carrying-capacity principles, and environmental monitoring.",
  cardDescription:
    "Learn how to identify and plan priority areas for sustainable aquaculture using Marine Spatial Planning, spatial criteria, stakeholder analysis, and environmental monitoring.",
  hero: academyImages.marineSpatial,
  level: "Intermediate",
  format: "Fully Online",
  mode: "Individual Self-Paced",
  enrollment: "Open Enrollment",
  hours: "12–14 Learning Hours",
  access: "30-Day Access",
  language: "English",
  languageSupport: "Bahasa Indonesia Support",
  certificate: "BARUNA Digital Certificate of Completion",
  primaryCategory: "Aquaculture",
  relatedCategories: ["Marine Spatial Planning", "Ocean Governance", "Marine Conservation"],
  tags: ["Aquaculture", "Marine Spatial Planning", "GIS", "Ocean Governance"],
} as const;

export type AzaQuizQuestion = {
  q: string;
  choices: string[];
  answer: number; // index of correct choice
};

export type AzaAssignmentField = { key: string; label: string };

export type AzaAssignment = {
  key: string;
  title: string;
  instructions: string;
  fields: AzaAssignmentField[];
  weight: number; // % of final grade for this assignment (0 = quiz-only module)
};

export type AzaModule = {
  no: number;
  code: string;
  title: string;
  summary: string;
  content: string[];
  activity?: string;
  quiz: AzaQuizQuestion[];
  assignment?: AzaAssignment;
  hours: number;
};

// Assessment weights (must sum to 95 — final 5% is the post-course reflection)
export const AZA_WEIGHTS = {
  quizzes: 20,
  institutionalStakeholder: 10,
  spatialInventory: 10,
  criteriaMatrix: 15,
  monitoringPlan: 10,
  finalProject: 30,
  reflection: 5,
} as const;

export const AZA_MODULES: AzaModule[] = [
  {
    no: 0,
    code: "AZA-M0",
    title: "Course Orientation",
    summary:
      "Welcome, program overview, learning outcomes, navigation, assessment requirements, case-study introduction, and a diagnostic pre-test.",
    content: [
      "Welcome to the Course",
      "Program Overview",
      "Learning Outcomes",
      "How to Navigate the Course",
      "Assessment Requirements",
      "Introduction to the AZA Case Study",
      "Pre-Test (diagnostic only — not counted toward the final grade)",
    ],
    activity:
      "Complete participant profile, select a learning-case option (A. BARUNA Simulation Case, or B. Participant's Own Area), and complete the diagnostic pre-test.",
    quiz: [
      {
        q: "Which of the following best describes the pre-test?",
        choices: [
          "It counts for 20% of the final grade",
          "It is diagnostic only and does not count toward the final grade",
          "It replaces the post-test",
          "It is a group assessment",
        ],
        answer: 1,
      },
      {
        q: "Which case option is available to participants?",
        choices: [
          "Only a BARUNA simulation case",
          "Only the participant's own area",
          "Either the BARUNA simulation case or the participant's own area",
          "A case assigned by a cohort leader",
        ],
        answer: 2,
      },
    ],
    hours: 1,
  },
  {
    no: 1,
    code: "AZA-M1",
    title: "Marine Space, Competition and Complexity",
    summary:
      "Marine space as a limited resource, multiple uses, competition, and the consequences of unplanned aquaculture development.",
    content: [
      "Marine space as a limited resource",
      "Multiple uses of marine and coastal areas",
      "Aquaculture as part of an interconnected spatial system",
      "Competition involving fisheries, tourism, shipping, energy, conservation, ports, and coastal infrastructure",
      "Spatial conflicts",
      "Consequences of aquaculture development without planning",
    ],
    activity:
      "Identify three potential marine-space conflicts in a selected coastal area.",
    quiz: [
      {
        q: "Which is NOT typically a competing use of marine and coastal space?",
        choices: ["Shipping lanes", "Tourism", "Rainforest logging", "Marine conservation"],
        answer: 2,
      },
      {
        q: "The main reason marine space must be planned is that it is:",
        choices: [
          "Unlimited but poorly mapped",
          "A limited resource with multiple, often competing uses",
          "Governed by a single agency",
          "Used only for fisheries",
        ],
        answer: 1,
      },
      {
        q: "Aquaculture development without spatial planning most often leads to:",
        choices: [
          "Automatic ecosystem recovery",
          "Reduced regulation",
          "Spatial and environmental conflict",
          "Higher fisheries yields",
        ],
        answer: 2,
      },
    ],
    hours: 1,
  },
  {
    no: 2,
    code: "AZA-M2",
    title: "Marine Spatial Planning",
    summary:
      "MSP as a public, policy-driven, decision-making process for the spatial and temporal allocation of marine activities.",
    content: [
      "Definition of Marine Spatial Planning",
      "MSP as a public and policy-driven process",
      "Spatial and temporal allocation of activities",
      "Integration of scientific data, policy objectives, and stakeholder input",
      "MSP as a decision-making framework",
      "Aquaculture with and without MSP",
      "Strategic spatial outputs and maps",
    ],
    activity: "Identify existing and potential uses in a selected coastal or marine area.",
    quiz: [
      {
        q: "MSP is best described as:",
        choices: [
          "A private commercial planning tool",
          "A public, policy-driven process allocating marine activities in space and time",
          "A single-sector fisheries plan",
          "An environmental impact assessment method",
        ],
        answer: 1,
      },
      {
        q: "Which input is essential to a credible MSP process?",
        choices: [
          "Only scientific data",
          "Only stakeholder input",
          "Scientific data, policy objectives, and stakeholder input",
          "Only ministerial decree",
        ],
        answer: 2,
      },
    ],
    hours: 1,
  },
  {
    no: 3,
    code: "AZA-M3",
    title: "Introduction to Allocated Zones for Aquaculture",
    summary:
      "AZA as a practical implementation tool derived from MSP, classifying areas as suitable, suitable with restriction, or unsuitable.",
    content: [
      "Definition of an Allocated Zone for Aquaculture",
      "AZA as a practical implementation tool derived from MSP",
      "Difference and complementarity between MSP and AZA",
      "MSP–AZA–site licensing workflow",
      "AZA implementation principles",
      "Zoning and monitoring",
      "Ecosystem approach to aquaculture",
      "Multiple criteria, limiting factors and priorities",
      "Economic, environmental, and social benefits",
    ],
    activity: "Interactive area-classification exercise.",
    quiz: [
      {
        q: "AZA translates MSP into:",
        choices: [
          "A single-project environmental permit",
          "More detailed planning specifically for sustainable aquaculture development",
          "A national fisheries quota",
          "A tourism master plan",
        ],
        answer: 1,
      },
      {
        q: "The three AZA area classifications are:",
        choices: [
          "Suitable / Restricted / Unsuitable",
          "Green / Yellow / Red-listed species",
          "Coastal / Offshore / Deep sea",
          "Private / Public / Communal",
        ],
        answer: 0,
      },
      {
        q: "The ecosystem approach to aquaculture requires:",
        choices: [
          "Ignoring social factors",
          "Balancing environmental, economic, and social objectives",
          "Maximising short-term production only",
          "Excluding stakeholder consultation",
        ],
        answer: 1,
      },
    ],
    hours: 1,
  },
  {
    no: 4,
    code: "AZA-M4",
    title: "Governance and Institutional Framework",
    summary:
      "Legal context, institutional roles, licensing and leasing, participatory zoning, and monitoring/enforcement responsibilities.",
    content: [
      "Legal and regulatory context",
      "National and local aquaculture plans",
      "Institutional roles and responsibilities",
      "Inter-agency coordination",
      "Licensing and leasing processes",
      "Participatory and transparent zoning",
      "Integration of AZA into planning and regulation",
      "Monitoring and enforcement responsibilities",
    ],
    quiz: [
      {
        q: "Effective AZA governance requires above all:",
        choices: [
          "A single agency to make all decisions",
          "Inter-agency coordination and clear roles",
          "No licensing framework",
          "Only ministerial approval",
        ],
        answer: 1,
      },
      {
        q: "Participatory zoning improves:",
        choices: [
          "Only enforcement speed",
          "Legitimacy, transparency, and social acceptance",
          "Only technical accuracy",
          "Nothing measurable",
        ],
        answer: 1,
      },
    ],
    assignment: {
      key: "institutional_map",
      title: "Institutional Map",
      instructions:
        "Prepare an Institutional Map for your selected study area. List every relevant authority and describe its jurisdiction, planning, licensing and monitoring roles, and coordination relationships.",
      fields: [
        { key: "institution", label: "Institution" },
        { key: "jurisdiction", label: "Jurisdiction" },
        { key: "responsibility", label: "Responsibility" },
        { key: "planning_role", label: "Role in Planning" },
        { key: "licensing_role", label: "Role in Licensing" },
        { key: "monitoring_role", label: "Role in Monitoring" },
        { key: "coordination", label: "Coordination Relationship" },
      ],
      weight: 5,
    },
    hours: 1.5,
  },
  {
    no: 5,
    code: "AZA-M5",
    title: "AZA Methodological Process",
    summary:
      "The seven-stage FAO–GFCM AZA methodological process, from contextualisation to finalisation and implementation.",
    content: [
      "1. Contextualisation of the establishment process",
      "2. Information and data collection",
      "3. Pre-selection of potential AZA",
      "4. Consultation and validation",
      "5. Analysis of aquaculture potentiality",
      "6. Carrying-capacity and monitoring plans",
      "7. Finalisation and implementation",
      "Principal methodological components: needs and objectives; sector analysis; legal framework; study area; stakeholder identification; parameters; fieldwork; criteria; preliminary maps and reports; participatory approach; thematic cartography; environmental and socio-economic studies; compatibility assessment; proposed activities; carrying capacity; monitoring; final legal arrangements.",
    ],
    activity:
      "Interactive process map, arrange-the-process exercise, methodological planning checklist, and scenario-based quiz.",
    quiz: [
      {
        q: "Which is the correct starting stage of the AZA process?",
        choices: [
          "Consultation and validation",
          "Contextualisation of the establishment process",
          "Finalisation and implementation",
          "Carrying-capacity plans",
        ],
        answer: 1,
      },
      {
        q: "Consultation and validation happens:",
        choices: [
          "Only at the end of the process",
          "After pre-selection and before analysis of potentiality",
          "Before any data is collected",
          "Never — it is optional",
        ],
        answer: 1,
      },
      {
        q: "Carrying capacity and monitoring plans are prepared:",
        choices: [
          "Before pre-selection",
          "After analysis of aquaculture potentiality",
          "Instead of finalisation",
          "Only by external consultants",
        ],
        answer: 1,
      },
    ],
    hours: 1.5,
  },
  {
    no: 6,
    code: "AZA-M6",
    title: "Spatial Data and Parameters",
    summary:
      "Study-area definition, primary vs secondary data, georeferenced information, GIS, and the environmental / administrative / socio-economic parameters that feed AZA.",
    content: [
      "Definition of the study area",
      "Primary and secondary data",
      "Georeferenced data",
      "GIS, mapping, satellite and remote-sensing information",
      "Data availability, accuracy, scale and limitations",
      "Environmental parameters (bathymetry, seabed, currents, waves, SST, chlorophyll, water quality, sensitive habitats)",
      "Administrative and socio-economic parameters (MPAs, fishing areas, tourism, diving, discharges, river mouths, shorelines, ports, shipping, military, pipelines, cables, oil & gas, coastal infrastructure, livelihoods, market access)",
    ],
    quiz: [
      {
        q: "Which is a primary data source for AZA?",
        choices: [
          "A previously published national atlas",
          "New bathymetric surveys collected in the field",
          "A generic textbook chapter",
          "A press release",
        ],
        answer: 1,
      },
      {
        q: "Georeferenced data are essential because they:",
        choices: [
          "Are always free",
          "Allow spatial overlay and analysis in GIS",
          "Replace field validation",
          "Guarantee data accuracy",
        ],
        answer: 1,
      },
    ],
    assignment: {
      key: "spatial_inventory",
      title: "AZA Spatial Data Inventory",
      instructions:
        "Complete the AZA Spatial Data Inventory for your study area. Identify each parameter needed, its category, availability, source, format, scale, quality, relevance, gaps, and recommended action.",
      fields: [
        { key: "parameter", label: "Data Parameter" },
        { key: "category", label: "Category" },
        { key: "availability", label: "Available / Unavailable" },
        { key: "source", label: "Data Source" },
        { key: "format", label: "Data Format" },
        { key: "scale", label: "Spatial Scale" },
        { key: "quality", label: "Data Quality" },
        { key: "relevance", label: "Relevance" },
        { key: "gap", label: "Data Gap" },
        { key: "action", label: "Recommended Action" },
      ],
      weight: 10,
    },
    hours: 1.5,
  },
  {
    no: 7,
    code: "AZA-M7",
    title: "Criteria and Multi-Criteria Analysis",
    summary:
      "Environmental, socio-economic, administrative and regulatory criteria; suitability thresholds; scoring; weighting; and compatibility assessment.",
    content: [
      "Environmental criteria",
      "Socio-economic criteria",
      "Administrative and regulatory criteria",
      "Suitability thresholds",
      "Exclusion criteria",
      "Limiting factors",
      "Suitability scoring",
      "Criteria weighting",
      "Compatibility assessment",
      "Interpretation of results",
    ],
    quiz: [
      {
        q: "An 'exclusion criterion' is one that:",
        choices: [
          "Slightly reduces suitability",
          "Automatically classifies an area as unsuitable",
          "Increases the score",
          "Applies only to socio-economic factors",
        ],
        answer: 1,
      },
      {
        q: "Weighting is used to reflect:",
        choices: [
          "Random preferences",
          "The relative importance of each criterion",
          "The order of data collection",
          "The size of the study area",
        ],
        answer: 1,
      },
      {
        q: "A limiting factor is:",
        choices: [
          "An unimportant criterion",
          "A criterion that constrains suitability regardless of others",
          "A stakeholder preference",
          "A synonym for weighting",
        ],
        answer: 1,
      },
    ],
    assignment: {
      key: "criteria_matrix",
      title: "Individual AZA Criteria Matrix",
      instructions:
        "Develop your AZA Criteria Matrix. For each criterion, define the unit, threshold, suitability score, weight, whether it is a limiting factor, source and justification.",
      fields: [
        { key: "criterion", label: "Criterion" },
        { key: "category", label: "Category" },
        { key: "unit", label: "Unit" },
        { key: "threshold", label: "Threshold" },
        { key: "score", label: "Suitability Score" },
        { key: "weight", label: "Weight" },
        { key: "limiting", label: "Limiting Factor? (Y/N)" },
        { key: "source", label: "Data Source" },
        { key: "justification", label: "Justification" },
      ],
      weight: 15,
    },
    hours: 1.5,
  },
  {
    no: 8,
    code: "AZA-M8",
    title: "Stakeholder Analysis",
    summary:
      "Identifying stakeholders, their interests and influence, spatial-use conflicts, and consultation, validation and engagement strategies.",
    content: [
      "Identification of relevant stakeholders",
      "Interest and influence",
      "Potential support and resistance",
      "Spatial-use conflicts",
      "Consultation methods",
      "Validation mechanisms",
      "Transparency and documentation",
      "Social acceptance and equity",
    ],
    quiz: [
      {
        q: "A high-influence, high-interest stakeholder should be:",
        choices: [
          "Ignored",
          "Managed closely and engaged early",
          "Only informed at the end",
          "Delegated to another agency",
        ],
        answer: 1,
      },
      {
        q: "Documenting consultations is important because it:",
        choices: [
          "Slows the process for no benefit",
          "Provides transparency and traceability",
          "Guarantees agreement",
          "Replaces the AZA proposal",
        ],
        answer: 1,
      },
    ],
    assignment: {
      key: "stakeholder_matrix",
      title: "Stakeholder Interest–Influence Matrix",
      instructions:
        "Complete a Stakeholder Interest–Influence Matrix for your study area. For each stakeholder, describe their interest, influence, expected impact, potential conflict, engagement strategy, consultation method, and the responsible authority.",
      fields: [
        { key: "stakeholder", label: "Stakeholder" },
        { key: "interest", label: "Interest" },
        { key: "influence", label: "Influence" },
        { key: "impact", label: "Expected Impact" },
        { key: "conflict", label: "Potential Conflict" },
        { key: "engagement", label: "Engagement Strategy" },
        { key: "consultation", label: "Consultation Method" },
        { key: "authority", label: "Responsible Authority" },
      ],
      weight: 5,
    },
    hours: 1.5,
  },
  {
    no: 9,
    code: "AZA-M9",
    title: "Carrying Capacity and Environmental Monitoring",
    summary:
      "Aquaculture carrying capacity, Allowable Zone of Effect, indicators, thresholds, corrective action and adaptive management.",
    content: [
      "Aquaculture carrying capacity",
      "Relationship between production and environmental conditions",
      "Allowable Zone of Effect",
      "Environmental indicators",
      "Monitoring locations",
      "Monitoring frequency",
      "Thresholds",
      "Corrective action",
      "Adaptive management",
      "Environmental Monitoring Programme",
    ],
    quiz: [
      {
        q: "The Allowable Zone of Effect defines:",
        choices: [
          "The area where all environmental change is prohibited",
          "The bounded area within which specified environmental effects are permitted",
          "The maximum farm size",
          "The area of marine protected areas",
        ],
        answer: 1,
      },
      {
        q: "Adaptive management requires:",
        choices: [
          "A one-off monitoring event",
          "Iterative monitoring, review, and adjustment of management measures",
          "Never revising thresholds",
          "Only satellite data",
        ],
        answer: 1,
      },
    ],
    assignment: {
      key: "monitoring_plan",
      title: "Draft Environmental Monitoring Plan",
      instructions:
        "Prepare a Draft Environmental Monitoring Plan for your proposed AZA. For each parameter, define its purpose, location, frequency, method, threshold, responsible party, reporting mechanism, and corrective action.",
      fields: [
        { key: "parameter", label: "Monitoring Parameter" },
        { key: "purpose", label: "Purpose" },
        { key: "location", label: "Monitoring Location" },
        { key: "frequency", label: "Frequency" },
        { key: "method", label: "Method" },
        { key: "threshold", label: "Threshold" },
        { key: "responsible", label: "Responsible Party" },
        { key: "reporting", label: "Reporting Mechanism" },
        { key: "corrective", label: "Corrective Action" },
      ],
      weight: 10,
    },
    hours: 1.5,
  },
  {
    no: 10,
    code: "AZA-M10",
    title: "Case Studies and Adaptation",
    summary:
      "Selected AZA case studies, lessons learned, and adaptation to ASEAN and Indonesian contexts.",
    content: [
      "Selected AZA case studies",
      "Lessons from implementation",
      "Differences in geographical and institutional contexts",
      "Adaptation based on data availability",
      "Institutional challenges",
      "Stakeholder involvement",
      "Transferability of the approach",
      "Adaptation to ASEAN and Indonesian contexts",
    ],
    activity:
      "Identify three lessons that can be adapted to your selected area. Reflection: What elements should be adapted rather than copied directly?",
    quiz: [
      {
        q: "AZA case studies from other regions should be:",
        choices: [
          "Copied directly",
          "Adapted to local ecological, institutional and social context",
          "Ignored",
          "Applied only in identical geographies",
        ],
        answer: 1,
      },
      {
        q: "A key lesson from AZA implementation is that success depends on:",
        choices: [
          "Data alone",
          "Combining data, participatory processes and institutional commitment",
          "Excluding stakeholders",
          "Bypassing governance",
        ],
        answer: 1,
      },
    ],
    hours: 1,
  },
];

// ----------------------------------------------------------------------------
// Final Individual Project — Preliminary AZA Proposal
// ----------------------------------------------------------------------------

export const AZA_PROJECT_COMPONENTS = [
  "Study-area profile",
  "Aquaculture-development objective",
  "Selected species or commodity",
  "Relevant legal and institutional context",
  "Institutional map",
  "Stakeholder map",
  "Spatial-data inventory",
  "Environmental criteria",
  "Socio-economic criteria",
  "Administrative and regulatory criteria",
  "Criteria weighting matrix",
  "Limiting factors",
  "Preliminary suitability classification",
  "Classification of suitable, restricted, and unsuitable areas",
  "Preliminary AZA map or zoning sketch",
  "Justification for the proposed AZA",
  "Management recommendations",
  "Draft Environmental Monitoring Plan",
  "Key data limitations",
  "Individual implementation action plan",
];

export const AZA_PROJECT_UPLOADS = [
  { key: "template", label: "Completed project template", required: true },
  { key: "map", label: "Preliminary map or zoning sketch", required: true },
  { key: "summary", label: "Executive summary (max 2 pages)", required: true },
  { key: "reflection", label: "Final individual reflection", required: true },
  {
    key: "presentation",
    label: "Recorded project presentation (max 5 minutes) — optional",
    required: false,
  },
] as const;

// ----------------------------------------------------------------------------
// Post-Test
// ----------------------------------------------------------------------------

export const AZA_POSTTEST: AzaQuizQuestion[] = [
  {
    q: "MSP and AZA are:",
    choices: [
      "Two names for the same tool",
      "Complementary — MSP is the multi-sectoral framework, AZA is the aquaculture-specific implementation",
      "Alternatives — a country chooses one or the other",
      "Unrelated processes",
    ],
    answer: 1,
  },
  {
    q: "In AZA, an area classified as 'Suitable with Restriction' is one that:",
    choices: [
      "Cannot be used for aquaculture at all",
      "Can be used for aquaculture only under specified regulations or safeguards",
      "Is freely available for any aquaculture activity",
      "Is reserved for tourism",
    ],
    answer: 1,
  },
  {
    q: "Carrying capacity influences AZA because it:",
    choices: [
      "Sets the visual appearance of maps",
      "Determines how much aquaculture activity a zone can sustain without unacceptable environmental change",
      "Is unrelated to zoning",
      "Only affects licensing fees",
    ],
    answer: 1,
  },
  {
    q: "Which combination of criteria is most typical of an AZA suitability analysis?",
    choices: [
      "Environmental only",
      "Environmental, socio-economic, and administrative/regulatory",
      "Regulatory only",
      "Financial only",
    ],
    answer: 1,
  },
  {
    q: "Effective stakeholder engagement in AZA is best characterised by:",
    choices: [
      "One-off information sharing",
      "Iterative consultation, transparency, and documented feedback",
      "Consultation only at the end",
      "Engagement only with government",
    ],
    answer: 1,
  },
  {
    q: "The AZA methodological process begins with:",
    choices: ["Finalisation", "Contextualisation", "Consultation", "Monitoring"],
    answer: 1,
  },
  {
    q: "An Environmental Monitoring Plan should specify:",
    choices: [
      "Parameters, locations, frequency, thresholds, responsibilities and corrective action",
      "Only which agency signs the plan",
      "Only the number of samples",
      "Only species to be farmed",
    ],
    answer: 0,
  },
  {
    q: "Which of the following is a limiting factor typical for aquaculture zoning?",
    choices: [
      "Depth or current speed outside the acceptable range",
      "Distance from the nearest airport",
      "Height of the tallest building on shore",
      "Number of restaurants nearby",
    ],
    answer: 0,
  },
  {
    q: "AZA supports sustainable aquaculture primarily by:",
    choices: [
      "Guaranteeing production volumes",
      "Aligning spatial suitability with environmental limits and stakeholder interests",
      "Removing the need for licensing",
      "Replacing environmental impact assessment",
    ],
    answer: 1,
  },
  {
    q: "The passing grade for this course is:",
    choices: ["50/100", "60/100", "70/100", "80/100"],
    answer: 2,
  },
];

// ----------------------------------------------------------------------------
// Course-evaluation questions (1–5 scale)
// ----------------------------------------------------------------------------

export const AZA_EVALUATION_ITEMS = [
  "The course objectives were clearly stated.",
  "The content was relevant to my work in marine and fisheries.",
  "The modules were well structured and easy to follow.",
  "The assignments deepened my understanding of AZA.",
  "The final project template was useful and clear.",
  "The written feedback from the assigned expert was helpful.",
  "The learning resources (templates, glossary, guides) were sufficient.",
  "I would recommend this course to a colleague.",
];

// ----------------------------------------------------------------------------
// Target participants and prerequisites
// ----------------------------------------------------------------------------

export const AZA_AUDIENCE = [
  "Government officials responsible for aquaculture, marine spatial planning, coastal management, environment, and licensing",
  "Regional and local government planners",
  "Aquaculture technical officers and extension workers",
  "Marine and coastal planners",
  "GIS and spatial-data practitioners",
  "Academics and researchers",
  "Conservation-area managers",
  "Development partners",
  "Aquaculture associations and practitioners",
  "Professionals involved in sustainable blue-economy development",
];

export const AZA_PREREQUISITE =
  "Basic knowledge of aquaculture, marine and coastal management, spatial planning, environmental management, public policy, or GIS is recommended but not mandatory.";

// ----------------------------------------------------------------------------
// Learning outcomes
// ----------------------------------------------------------------------------

export const AZA_OUTCOMES = [
  "Explain competition and complexity in the use of marine and coastal space.",
  "Explain the relationship between Marine Spatial Planning and Allocated Zones for Aquaculture.",
  "Identify the principal stages in the FAO–GFCM-based AZA methodological process.",
  "Identify environmental, socio-economic, administrative, and regulatory data required for aquaculture zoning.",
  "Develop preliminary aquaculture suitability criteria and threshold values.",
  "Analyse stakeholders, institutional responsibilities, interests, influence, and potential spatial conflicts.",
  "Classify areas as suitable, suitable with restrictions, or unsuitable for aquaculture.",
  "Apply basic multi-criteria analysis to an aquaculture zoning case.",
  "Prepare a preliminary environmental monitoring plan.",
  "Develop an individual preliminary AZA proposal.",
];

// ----------------------------------------------------------------------------
// Individual learning journey (display flow)
// ----------------------------------------------------------------------------

export const AZA_JOURNEY = [
  "View Program",
  "Enroll Anytime",
  "Start Course Immediately",
  "Complete Participant Profile",
  "Complete Pre-Test",
  "Complete Modules 1–3",
  "Complete Modules 4–6",
  "Complete Modules 7–9",
  "Review Case Studies",
  "Develop Individual AZA Proposal",
  "Submit Final Project",
  "Complete Post-Test",
  "Administrative Completeness Check",
  "Asynchronous Expert Review",
  "Receive Written Feedback",
  "Revise Project if Required",
  "Final Approval",
  "Complete Course Evaluation",
  "Receive Digital Certificate",
  "Join the AZA and Sustainable Aquaculture Community",
];

// ----------------------------------------------------------------------------
// Resources, related programs, FAQs, technical requirements
// ----------------------------------------------------------------------------

export const AZA_RESOURCES = [
  "Source presentation as reference material",
  "Course handbook",
  "Glossary of MSP and AZA terms",
  "Methodological-process summary",
  "Stakeholder-mapping template",
  "Institutional-mapping template",
  "Spatial-data-inventory template",
  "AZA criteria-matrix template",
  "Environmental Monitoring Plan template",
  "Final-project template",
  "Example suitability-classification map",
  "Example zoning sketch",
  "Case-study package",
  "Assessment rubric",
  "Technical guide for uploading assignments",
];

export const AZA_TECHNICAL = [
  "A modern browser (Chrome, Edge, Firefox, or Safari — latest 2 versions)",
  "A stable internet connection (min 2 Mbps)",
  "A device capable of viewing PDF, DOCX and simple map images",
  "No paid GIS software required — templates and simplified mapping materials are provided",
  "A working email address for notifications",
];

export const AZA_RELATED = [
  {
    title: "Marine Spatial Planning Practice",
    href: "/academy/training",
    tag: "Training",
  },
  {
    title: "Introduction to Marine Spatial Planning",
    href: "/academy/workshop",
    tag: "Workshop",
  },
  {
    title: "Aquaculture Systems Foundations",
    href: "/academy/self-paced/sp-01",
    tag: "Self-paced",
  },
  {
    title: "Aquaculture Biosecurity",
    href: "/academy/certification",
    tag: "Certification",
  },
];

export const AZA_FAQ = [
  { q: "Is this a live training?", a: "No. The course is fully online and 100% asynchronous." },
  {
    q: "Do I need to wait for a cohort?",
    a: "No. Enrollment is open, and participants may begin at any time.",
  },
  {
    q: "Is there group work?",
    a: "No. All assignments and the final project are completed individually.",
  },
  { q: "How long does the course take?", a: "The estimated learning time is 12–14 hours." },
  {
    q: "How long can I access the course?",
    a: "Participants receive 30 days of access from the enrollment date.",
  },
  {
    q: "Do I need GIS software?",
    a: "No paid GIS software is required. Templates and simplified mapping materials are provided.",
  },
  {
    q: "Can I use my own working area?",
    a: "Yes. Participants may choose either the BARUNA simulation case or their own selected area.",
  },
  {
    q: "Is the final project reviewed?",
    a: "Yes. The final proposal is reviewed asynchronously by an assigned expert.",
  },
  {
    q: "When will I receive feedback?",
    a: "Feedback should normally be provided within five working days after a complete submission.",
  },
  {
    q: "Is the certificate issued automatically?",
    a: "The certificate is issued only after all requirements are completed, the passing grade is achieved, and the final project is approved.",
  },
];
