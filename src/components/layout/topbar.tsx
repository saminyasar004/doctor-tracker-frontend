import { Fragment, useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, LogOut, Menu, Search, Settings, User } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { UserAvatar } from "@/components/common/user-avatar";
import { getSession, logout } from "@/lib/api/auth";
import { CommandPalette, type PaletteTarget } from "./command-palette";

function crumbs(path: string): { label: string; to?: "/dashboard" | "/doctors" | "/patients" }[] {
  if (path.startsWith("/doctors/"))
    return [{ label: "Doctors", to: "/doctors" }, { label: "Profile" }];
  if (path.startsWith("/doctors")) return [{ label: "Doctors" }];
  if (path.startsWith("/patients")) return [{ label: "Patients" }];
  return [{ label: "Dashboard" }];
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const user = getSession()?.user;
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSelect = (t: PaletteTarget) => {
    if (t.kind === "page") navigate({ to: t.path });
    else if (t.result.type === "doctor")
      navigate({ to: "/doctors/$id", params: { id: t.result.id }, search: {} });
    else navigate({ to: "/patients", search: { q: t.result.title } });
  };

  const items = crumbs(pathname);

  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>
      <Breadcrumb className="min-w-0">
        <BreadcrumbList>
          {items.map((c, i) => (
            <Fragment key={c.label}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {c.to ? (
                  <BreadcrumbLink asChild>
                    <Link to={c.to}>{c.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="font-medium">{c.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="hidden h-9 w-64 justify-start gap-2 rounded-lg bg-background/60 font-normal text-muted-foreground lg:flex"
        >
          <Search /> <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px]">
            {isMac ? "⌘" : "Ctrl"} K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setOpen(true)}
          aria-label="Search"
        >
          <Search />
        </Button>
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-brand ring-2 ring-background" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Account menu" className="ml-1 rounded-full">
              <UserAvatar name={user?.name ?? "Admin"} src={user?.avatarUrl} className="size-8" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Settings /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                await logout();
                navigate({ to: "/login" });
              }}
            >
              <LogOut /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CommandPalette open={open} onOpenChange={setOpen} onSelect={onSelect} />
    </header>
  );
}
