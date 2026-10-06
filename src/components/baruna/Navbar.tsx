import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { listMyNotifications } from "@/lib/notifications/notifications.functions";
import {
  Home,
  GraduationCap,
  BookOpen,
  Users,
  Globe,
  MessagesSquare,
  CalendarDays,
  Handshake,
  Info,
  Search,
  Bell,
  ChevronDown,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "./Logo";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useHomeExperience } from "./home-experience";
import { ProfileAvatar } from "./ProfileAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

const navItems: { key: TranslationKey; href: string; icon: LucideIcon }[] = [
  { key: "nav.home", href: "/", icon: Home },
  { key: "nav.academy", href: "/academy", icon: GraduationCap },
  { key: "nav.knowledgeHub", href: "/knowledge-hub", icon: BookOpen },
  { key: "nav.experts", href: "/experts", icon: Users },
  { key: "nav.fellowship", href: "/fellowship", icon: Globe },
  { key: "nav.community", href: "/community", icon: MessagesSquare },
  { key: "nav.events", href: "/events", icon: CalendarDays },
  { key: "nav.partnership", href: "/partnership", icon: Handshake },
  { key: "nav.about", href: "/about", icon: Info },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { authState, viewer, signOut } = useHomeExperience();
  const { t } = useLanguage();
  const isAdmin =
    viewer?.variant === "admin" ||
    ["super_admin", "admin", "management", "qa_reviewer", "approver"].includes(
      viewer?.primaryRoleCode ?? "",
    );
  const dashboardUrl = isAdmin
    ? "/admin"
    : viewer?.dashboardUrl ?? (viewer?.primaryRoleCode === "expert" ? "/experts/portal" : "/dashboard");

  const listNotificationsFn = useServerFn(listMyNotifications);
  const { data: notifications } = useQuery({
    queryKey: ["notifications", "my-navbar-badge"],
    queryFn: () => listNotificationsFn(),
    enabled: authState === "authenticated",
    staleTime: 15000,
  });

  const revisionCount = notifications?.filter((n) => n.type === "revision_requested").length ?? 0;
  const hasNotifications = (notifications?.length ?? 0) > 0;

  const handleSignOut = async () => {
    await signOut();
    await navigate({ to: "/", replace: true });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-md transition-all supports-[backdrop-filter]:bg-white/90">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 py-2.5 sm:py-3 w-full">
        <Link to="/" aria-label="BARUNA home" className="flex min-w-0 shrink items-center">
          <Logo className="h-8 xs:h-9 sm:h-10 xl:h-11 max-w-[135px] xs:max-w-[165px] sm:max-w-[190px] xl:max-w-[210px]" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0 2xl:gap-0.5 xl:flex" aria-label="Main">
          {navItems.map(({ key, href, icon: Icon }) => {
            const label = t(key);
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={key}
                to={href}
                className={`group flex flex-col items-center rounded-lg px-1.5 2xl:px-2 py-1 text-center transition-colors ${
                  active ? "text-marine" : "text-foreground/75 hover:text-marine"
                }`}
              >
                <Icon className="h-4.5 w-4.5 2xl:h-5 2xl:w-5" strokeWidth={2} />
                <span className="mt-0.5 whitespace-nowrap text-[0.67rem] 2xl:text-[0.7rem] font-semibold">
                  {label}
                </span>
                <span
                  className={`mt-0.5 h-0.5 w-5 2xl:w-6 rounded-full transition-colors ${
                    active ? "bg-marine" : "bg-transparent group-hover:bg-marine/40"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Link
            to="/search"
            className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-marine"
            aria-label={t("header.search")}
          >
            <Search className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </Link>
          <LanguageSwitcher variant="dropdown" />
          {authState === "authenticated" && viewer ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-muted"
                  aria-label={t("header.openAccountMenu")}
                >
                  <div className="relative shrink-0">
                    <ProfileAvatar name={viewer.displayName} url={viewer.avatarUrl} />
                    {revisionCount > 0 ? (
                      <span className="absolute -top-1 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-500 px-0.5 text-[8px] font-extrabold text-white shadow-xs">
                        {revisionCount}
                      </span>
                    ) : hasNotifications ? (
                      <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-marine ring-2 ring-background" />
                    ) : null}
                  </div>
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block max-w-20 2xl:max-w-28 truncate text-sm font-semibold text-navy">
                      {viewer.displayName}
                    </span>
                    <span className="block max-w-20 2xl:max-w-28 truncate text-xs text-muted-foreground">
                      {viewer.primaryRoleLabel}
                    </span>
                  </span>
                  <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{viewer.displayName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/notifications" className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-2">
                      <Bell className="h-4 w-4" /> {t("header.notifications")}
                    </span>
                    {revisionCount > 0 ? (
                      <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {revisionCount} {t("header.revisionRequired")}
                      </span>
                    ) : hasNotifications ? (
                      <span className="h-2 w-2 rounded-full bg-marine" />
                    ) : null}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account/profile">
                    <UserRound className="h-4 w-4" /> {t("header.myProfile")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={dashboardUrl}>
                    <LayoutDashboard className="h-4 w-4" /> {t("header.myDashboard")}
                  </Link>
                </DropdownMenuItem>
                {viewer.variant === "admin" ||
                ["super_admin", "admin", "management", "qa_reviewer", "approver"].includes(
                  viewer.primaryRoleCode,
                ) ? (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/admin/experts">
                        <UserCheck className="h-4 w-4" /> {t("header.expertVerification")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/governance/subjects">
                        <ClipboardCheck className="h-4 w-4" /> {t("header.approvalsGovernance")}
                      </Link>
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleSignOut()}>
                  <LogOut className="h-4 w-4" /> {t("header.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : authState === "loading" ? (
            <span
              className="h-9 w-28 animate-pulse rounded-full bg-muted"
              aria-label="Loading account"
            />
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                to="/auth"
                search={{ mode: "signin" }}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-navy hover:bg-muted"
              >
                {t("header.login")}
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="rounded-lg bg-marine px-3 py-2 text-sm font-semibold text-white hover:bg-marine/90"
              >
                {t("header.register")}
              </Link>
            </div>
          )}

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                className="grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-muted xl:hidden"
                aria-label={t("header.openMenu")}
              >
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="mb-4 flex items-center justify-between">
                <SheetTitle className="text-navy">{t("header.menu")}</SheetTitle>
                <LanguageSwitcher variant="segmented" />
              </div>
              <nav className="flex flex-col gap-1" aria-label="Mobile">
                {navItems.map(({ key, href, icon: Icon }) => (
                  <Link
                    key={key}
                    to={href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-marine"
                    activeProps={{ className: "bg-muted text-marine" }}
                  >
                    <Icon className="h-5 w-5" />
                    {t(key)}
                  </Link>
                ))}
                <div className="mt-4 border-t border-border pt-4">
                  {authState === "authenticated" && viewer ? (
                    <div className="space-y-1">
                      <Link
                        to="/notifications"
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-marine"
                      >
                        <span className="flex items-center gap-3">
                          <Bell className="h-5 w-5" /> {t("header.notifications")}
                        </span>
                        {revisionCount > 0 ? (
                          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                            {revisionCount} {t("header.revisionRequired")}
                          </span>
                        ) : hasNotifications ? (
                          <span className="h-2 w-2 rounded-full bg-marine" />
                        ) : null}
                      </Link>
                      <Link
                        to="/account/profile"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-marine"
                      >
                        <UserRound className="h-5 w-5" /> {t("header.myProfile")}
                      </Link>
                      <Link
                        to={dashboardUrl}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-marine"
                      >
                        <LayoutDashboard className="h-5 w-5" /> {t("header.myDashboard")}
                      </Link>
                      {viewer.variant === "admin" ||
                      ["super_admin", "admin", "management", "qa_reviewer", "approver"].includes(
                        viewer.primaryRoleCode,
                      ) ? (
                        <Link
                          to="/governance/subjects"
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-marine"
                        >
                          <ClipboardCheck className="h-5 w-5" /> {t("header.approvalsGovernance")}
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          void handleSignOut();
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-marine"
                      >
                        <LogOut className="h-5 w-5" /> {t("header.signOut")}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        to="/auth"
                        search={{ mode: "signin" }}
                        onClick={() => setOpen(false)}
                        className="rounded-lg border border-border px-3 py-2 text-center text-sm font-semibold"
                      >
                        {t("header.login")}
                      </Link>
                      <Link
                        to="/auth"
                        search={{ mode: "signup" }}
                        onClick={() => setOpen(false)}
                        className="rounded-lg bg-marine px-3 py-2 text-center text-sm font-semibold text-white"
                      >
                        {t("header.register")}
                      </Link>
                    </div>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
