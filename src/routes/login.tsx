import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, useAnimationControls } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/logo";
import { DEMO_CREDENTIALS, login } from "@/lib/api/auth";
import { describeApiProblem } from "@/lib/api/health";

/**
 * A rejected sign-in and an unreachable API look identical in the browser ("Failed
 * to fetch"). `GET /health` is public, so probing it turns the second case into a
 * precise message instead of a generic network error.
 */
async function explainLoginFailure(err: unknown): Promise<string> {
  const message = err instanceof Error ? err.message : "Sign-in failed";
  if (!/could not reach|api address is not configured|failed to fetch/i.test(message)) {
    return message;
  }
  return describeApiProblem();
}

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Doctor Tracker" },
      { name: "description", content: "Sign in to the Doctor Tracker admin portal." },
      { property: "og:title", content: "Sign in — Doctor Tracker" },
      { property: "og:description", content: "Sign in to the Doctor Tracker admin portal." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const shake = useAnimationControls();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/\S+@\S+\.\S+/.test(email)) return setError("Enter a valid email");
    if (!password) return setError("Password is required");
    setLoading(true);
    setError(null);
    try {
      await login(email, password, remember);
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(await explainLoginFailure(err));
      shake.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.35 } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="bg-brand relative hidden overflow-hidden p-12 text-brand-foreground lg:flex lg:flex-col lg:justify-between">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-3xl border border-brand-foreground/30 bg-brand-foreground/10"
            style={{
              width: 80 + i * 40,
              height: 80 + i * 40,
              top: `${15 + i * 18}%`,
              left: `${10 + i * 20}%`,
            }}
            animate={{ y: [0, -16, 0], rotate: [0, 8, 0] }}
            transition={{ duration: 6 + i, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        <div className="relative font-semibold">Doctor Tracker</div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold">Every doctor. Every patient. One calm view.</h2>
        </div>
      </div>
      <div className="bg-mesh flex items-center justify-center p-6">
        <motion.div animate={shake} className="w-full max-w-sm">
          <Card className="rounded-2xl p-6 shadow-soft">
            <Logo />
            <h1 className="mt-6 text-2xl font-semibold">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Demo: {DEMO_CREDENTIALS.email} / {DEMO_CREDENTIALS.password}
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw">Password</Label>
                <div className="relative">
                  <Input
                    id="pw"
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    aria-label={show ? "Hide password" : "Show password"}
                    onClick={() => setShow(!show)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} /> Remember
                me
              </label>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}Sign in
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
