import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Doctor Tracker" },
      { name: "description", content: "Admin portal for doctors and patients." },
      { property: "og:title", content: "Doctor Tracker" },
      { property: "og:description", content: "Admin portal for doctors and patients." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
