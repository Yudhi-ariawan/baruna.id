export type PublicHomeStats = {
  activeTraining: number;
  verifiedExperts: number;
  openPublications: number;
  upcomingEvents: number;
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
  metrics: HomeMetric[];
};
