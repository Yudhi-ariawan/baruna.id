import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
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
  LogOut,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "./Logo";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useHomeExperience } from "./home-experience";
import { ProfileAvatar } from "./ProfileAvatar";

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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { authState, viewer, signOut } = useHomeExperience();
  const dashboardUrl = viewer?.variant === "admin" ? "/admin/users" : "/dashboard";

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" aria-label="BARUNA home" className="flex min-w-0 shrink-[2] items-center">
          <Logo className="h-10 max-w-[220px] sm:h-14 sm:max-w-none md:h-16" />
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

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/search"
            className="grid h-10 w-10 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-marine"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Link>
          {authState === "authenticated" && viewer ? (
            <>
              <Link
                to="/notifications"
                className="grid h-10 w-10 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-marine"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
              </Link>
              <Link
                to={dashboardUrl}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-muted"
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
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className="hidden h-10 w-10 place-items-center rounded-full text-foreground/60 transition-colors hover:bg-muted hover:text-marine sm:grid"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
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
                className="grid h-10 w-10 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-muted xl:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
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
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        void signOut();
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-marine"
                    >
                      <LogOut className="h-5 w-5" /> Sign out
                    </button>
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
