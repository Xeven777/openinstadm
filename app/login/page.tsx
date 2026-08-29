import { Suspense } from "react";
import { signIn } from "@/lib/auth";
import { getCampaignTemplate } from "@/lib/templates/campaign-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { StarIcon } from "@phosphor-icons/react/dist/ssr";

export const metadata = {
  title: "Sign in - OpenInstaDM",
  description: "Sign in to manage Instagram comment-to-DM campaigns.",
};

type LoginSearchParams = Promise<{
  checkEmail?: string;
  callbackUrl?: string;
  template?: string;
}>;

export default function LoginPage({
  searchParams,
}: {
  searchParams: LoginSearchParams;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({ searchParams }: { searchParams: LoginSearchParams }) {
  const params = await searchParams;
  const checkEmail = params.checkEmail === "1";
  const selectedTemplate = getCampaignTemplate(params.template);
  const templateCallbackUrl = selectedTemplate
    ? `/campaigns/new?template=${selectedTemplate.slug}`
    : null;
  const callbackUrl = params.callbackUrl ?? templateCallbackUrl ?? "/dashboard";

  async function sendMagicLink(formData: FormData) {
    "use server";
    await signIn("resend", {
      email: String(formData.get("email") ?? ""),
      redirectTo: callbackUrl,
    });
  }

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center px-6 lg:px-12">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="mb-10">
            <Image
              src="/logo3.svg"
              width={36}
              height={40}
              alt="OpenInstaDM"
              className="h-9 w-auto"
            />
          </div>

          {/* Heading */}
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
            Sign in
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            {selectedTemplate
              ? `Sign in to use the ${selectedTemplate.title} template.`
              : "Sign in by email, then connect your Instagram professional account."}
          </p>

          {/* Form */}
          {checkEmail ? (
            <div className="mt-10 text-center py-8 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="mb-4 inline-flex items-center justify-center size-12 rounded-full" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                Check your email
              </h2>
              <p className="mt-2 text-sm px-4" style={{ color: "var(--muted-foreground)" }}>
                We sent you a secure sign-in link. Open it on this device to continue.
              </p>
            </div>
          ) : (
            <form action={sendMagicLink} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium"
                  style={{ color: "var(--foreground)" }}
                >
                  Work email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="h-11 rounded-lg px-4 text-[15px]"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Your sign-in link stays active for 15 minutes.
              </p>

              <Button
                type="submit"
                className="w-full h-11 rounded-lg text-[15px] font-medium cursor-pointer"
                style={{
                  background: "var(--foreground)",
                  color: "var(--background)",
                }}
              >
                Send magic link
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-1 inline-block"
                >
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </Button>
            </form>
          )}

          {/* Footer */}
          <p className="mt-10 text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
            By continuing, you agree to our{" "}
            <a href="/legal/terms" className="underline underline-offset-2" style={{ color: "var(--muted-foreground)" }}>
              Terms
            </a>{" "}
            and{" "}
            <a href="/legal/privacy" className="underline underline-offset-2" style={{ color: "var(--muted-foreground)" }}>
              Privacy Policy
            </a>.
          </p>
        </div>
      </div>

      {/* Right panel — Testimonial / Brand */}
      <div
        className="hidden lg:flex flex-1 items-center justify-center p-10 bg-muted border-l-2"
      >
        <div className="w-full max-w-md">
          {/* Stars */}
          <div className="flex items-center gap-1 mb-6">
            {[...Array(5)].map((_, i) => (
              <StarIcon key={i} size={20} weight="fill" className="text-yellow-400" />
            ))}
          </div>

          {/* Quote */}
          <blockquote className="text-xl font-medium leading-snug tracking-tight" style={{ color: "var(--foreground)" }}>
            &ldquo;OpenInstaDM gave our team an automated starting point, so the first comment-to-DM pass already felt ready to ship.&rdquo;
          </blockquote>

          {/* Author */}
          <div className="mt-8 flex items-center gap-3">
            <div
              className="size-10 rounded-full flex items-center justify-center text-sm font-semibold"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              JD
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                Jane Doe
              </p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Head of Growth @ AcmeCo
              </p>
            </div>
          </div>

          {/* Partner logos */}
          <div className="mt-14 grid grid-cols-3 gap-6 items-center opacity-40">
            {["ANTHROPIC", "convex", "n8n", "NVIDIA", "Resend", "mintlify"].map((name) => (
              <div
                key={name}
                className="text-center text-xs font-semibold tracking-wider uppercase"
                style={{ color: "var(--muted-foreground)" }}
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
