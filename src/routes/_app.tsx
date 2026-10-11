import { useEffect, useState } from "react";
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { isAuthenticated, onSessionExpired } from "@/lib/api/auth";
import { sessionQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: () => {
    if (!isAuthenticated()) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Confirms the stored session against GET /auth/me and keeps the profile current.
  useQuery(sessionQuery);

  // An unrecoverable session (deleted account, revoked refresh token) must leave the
  // private shell at once, otherwise every query keeps failing in a loop.
  useEffect(() => {
    return onSessionExpired(() => {
      queryClient.clear();
      void navigate({ to: "/login", replace: true });
    });
  }, [navigate, queryClient]);
  useEffect(() => {
    const onFocus = () => void queryClient.invalidateQueries({ queryKey: ["auth"] });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [queryClient]);
  return (
    <div className="flex min-h-screen">
      <motion.aside
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ duration: 0.2 }}
        className="sticky top-0 hidden h-screen shrink-0 border-r bg-sidebar md:block"
      >
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </motion.aside>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppSidebar variant="mobile" onNavigate={() => setMobile(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobile(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
