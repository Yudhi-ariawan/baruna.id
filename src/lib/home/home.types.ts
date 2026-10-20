export type PublicHomeStats = {
  activeTraining: number;
  verifiedExperts: number;
  openPublications: number;
  upcomingEvents: number;
};

export type HomeKnowledgeResource = {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  metaLabel: string;
  externalUrl: string | null;
};

export type HomeMetricIcon =
  | "book"
  | "certificate"
  | "progress"
  | "completed"
  | "users"
  | "requests"
  | "reviews"
  | "audit"
  | "profile";

export type HomeMetric = {
  label: string;
  value: string;
  icon: HomeMetricIcon;
};

export type HomeViewer = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  primaryRoleCode: string;
  primaryRoleLabel: string;
  variant: "registered" | "participant" | "admin";
  dashboardUrl: string;
  /** Any active role may use the admin portal (/admin). */
  canUseAdminPortal: boolean;
  /** Any active role has a place in the curation console (/governance). */
  canUseCurationConsole: boolean;
  metrics: HomeMetric[];
};
