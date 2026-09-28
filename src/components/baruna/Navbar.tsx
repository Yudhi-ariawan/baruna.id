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

const navItems: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Academy", href: "/academy", icon: GraduationCap },
  { label: "Knowledge Hub", href: "/knowledge-hub", icon: BookOpen },
  { label: "Experts", href: "/experts", icon: Users },
  { label: "Fellowship & Exchange", href: "/fellowship", icon: Globe },
  { label: "Community", href: "/community", icon: MessagesSquare },
  { label: "Events", href: "/events", icon: CalendarDays },
  { label: "Partnership", href: "/partnership", icon: Handshake },
  { label: "About BARUNA", href: "/about", icon: Info },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { authState, viewer, signOut } = useHomeExperience();
  const dashboardUrl = viewer?.dashboardUrl ?? "/dashboard";

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
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75 w-full">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 py-2.5 sm:py-3 w-full">
        <Link to="/" aria-label="BARUNA home" className="flex min-w-0 shrink items-center">
          <Logo className="h-8 xs:h-9 sm:h-12 md:h-14 max-w-[140px] xs:max-w-[180px] sm:max-w-none" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Main">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={label}
                to={href}
                className={`group flex flex-col items-center rounded-lg px-2 py-1.5 text-center transition-colors ${
                  active ? "text-marine" : "text-foreground/75 hover:text-marine"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
                <span className="mt-0.5 whitespace-nowrap text-[0.7rem] font-semibold">
                  {label}
                </span>
                <span
                  className={`mt-0.5 h-0.5 w-6 rounded-full transition-colors ${
                    active ? "bg-marine" : "bg-transparent group-hover:bg-marine/40"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <Link
            to="/search"
            className="grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-marine"
            aria-label="Search"
          >
            <Search className="h-4 w-4 sm:h-5 sm:w-5" />
          </Link>
          {authState === "authenticated" && viewer ? (
            <>
              <Link
                to="/notifications"
                className="relative grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-marine"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                {revisionCount > 0 ? (
                  <span className="absolute top-0.5 right-0.5 flex h-3.5 min-w-[14px] sm:h-4 sm:min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[8px] sm:text-[9px] font-extrabold text-white shadow-xs">
                    {revisionCount}
                  </span>
                ) : hasNotifications ? (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-marine" />
                ) : null}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-muted"
                    aria-label="Open account menu"
                  >
                    <ProfileAvatar name={viewer.displayName} url={viewer.avatarUrl} />
                    <span className="hidden text-left leading-tight sm:block">
                      <span className="block max-w-28 truncate text-sm font-semibold text-navy">
                        {viewer.displayName}
                      </span>
                      <span className="block max-w-28 truncate text-xs text-muted-foreground">
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
                    <Link to="/account/profile">
                      <UserRound /> My Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={dashboardUrl}>
                      <LayoutDashboard /> My Dashboard
                    </Link>
                  </DropdownMenuItem>
                  {viewer.variant === "admin" ||
                  ["super_admin", "admin", "management", "qa_reviewer", "approver"].includes(
                    viewer.primaryRoleCode,
                  ) ? (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/experts">
                          <UserCheck /> Verifikasi Expert
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/governance/subjects">
                          <ClipboardCheck /> Approvals & Governance
                        </Link>
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void handleSignOut()}>
                    <LogOut /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
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
                Login
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="rounded-lg bg-marine px-3 py-2 text-sm font-semibold text-white hover:bg-marine/90"
              >
                Register
              </Link>
            </div>
          )}

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                className="grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-muted xl:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="mb-4 text-navy">Menu</SheetTitle>
              <nav className="flex flex-col gap-1" aria-label="Mobile">
                {navItems.map(({ label, href, icon: Icon }) => (
                  <Link
                    key={label}
                    to={href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-marine"
                    activeProps={{ className: "bg-muted text-marine" }}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
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
                          <Bell className="h-5 w-5" /> Notifikasi
                        </span>
                        {revisionCount > 0 ? (
                          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                            {revisionCount} Perlu Revisi
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
                        <UserRound className="h-5 w-5" /> My Profile
                      </Link>
                      <Link
                        to={dashboardUrl}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-marine"
                      >
                        <LayoutDashboard className="h-5 w-5" /> My Dashboard
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
                          <ClipboardCheck className="h-5 w-5" /> Approvals & Governance
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
                        <LogOut className="h-5 w-5" /> Sign out
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
                        Login
                      </Link>
                      <Link
                        to="/auth"
                        search={{ mode: "signup" }}
                        onClick={() => setOpen(false)}
                        className="rounded-lg bg-marine px-3 py-2 text-center text-sm font-semibold text-white"
                      >
                        Register
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
