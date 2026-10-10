import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronsLeft, LayoutDashboard, LogOut, Stethoscope, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/common/user-avatar";
import { getSession, logout } from "@/lib/api/auth";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { to: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { to: "/doctors" as const, label: "Doctors", icon: Stethoscope },
  { to: "/patients" as const, label: "Patients", icon: Users },
];

export function AppSidebar({
  collapsed = false,
  onToggle,
  variant = "desktop",
  onNavigate,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const user = getSession()?.user;
  const c = variant === "desktop" && collapsed;

  const doLogout = async () => {
    await logout();
    onNavigate?.();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-16 items-center px-4", c ? "justify-center" : "justify-between")}>
        <Logo collapsed={c} />
        {variant === "desktop" && !c && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onToggle}
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft />
          </Button>
        )}
      </div>
      <nav aria-label="Main" className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.to);
          const link = (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                c && "justify-center px-0",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId={`nav-pill-${variant}`}
                  className="absolute inset-0 rounded-lg border bg-card shadow-soft"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand" />
              )}
              <item.icon className={cn("relative size-4 shrink-0", active && "text-primary")} />
              {!c && <span className="relative">{item.label}</span>}
            </Link>
          );
          return c ? (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>
      <div className="p-3">
        {variant === "desktop" && c && (
          <Button
            variant="ghost"
            size="icon"
            className="mx-auto mb-2 flex size-8"
            onClick={onToggle}
            aria-label="Expand sidebar"
          >
            <ChevronsLeft className="rotate-180" />
          </Button>
        )}
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border bg-card p-2.5 shadow-soft",
            c && "flex-col p-2",
          )}
        >
          <UserAvatar name={user?.name ?? "Admin"} src={user?.avatarUrl} className="size-8" />
          {!c && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.name ?? "Admin"}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={doLogout}
                aria-label="Log out"
              >
                <LogOut />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Log out</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
