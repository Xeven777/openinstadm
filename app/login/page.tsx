import { Suspense } from "react";
import { signIn } from "@/lib/auth";
import { getCampaignTemplate } from "@/lib/templates/campaign-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { ArrowRightIcon, StarIcon } from "@phosphor-icons/react/dist/ssr";
import { FlickeringGrid } from "@/components/ui/flickering-grid";

export const metadata = {
  title: "Sign in - OpenInstaDM",
  description: "Sign in to manage Instagram comment-to-DM campaigns.",
};

type LoginSearchParams = Promise<{
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
  const selectedTemplate = getCampaignTemplate(params.template);
  const templateCallbackUrl = selectedTemplate
    ? `/campaigns/new?template=${selectedTemplate.slug}`
    : null;
  const callbackUrl = params.callbackUrl ?? templateCallbackUrl ?? "/dashboard";

  const hasResend = !!process.env.RESEND_API_KEY;
  const hasGoogle =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
  const hasGitHub = !!(
    (process.env.GITHUB_ID ?? process.env.GITHUB_CLIENT_ID) &&
    (process.env.GITHUB_SECRET ?? process.env.GITHUB_CLIENT_SECRET)
  );
  const hasOAuth = hasGoogle || hasGitHub;
  const hasAnyProvider = hasOAuth || hasResend;

  async function sendMagicLink(formData: FormData) {
    "use server";
    await signIn("resend", {
      email: String(formData.get("email") ?? ""),
      redirectTo: callbackUrl,
    });
  }

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: callbackUrl });
  }

  async function signInWithGitHub() {
    "use server";
    await signIn("github", { redirectTo: callbackUrl });
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
          <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {selectedTemplate
              ? `Sign in to use the ${selectedTemplate.title} template.`
              : hasOAuth
                ? "Sign in with your account to manage Instagram automations."
                : "Sign in by email, then connect your Instagram professional account."}
          </p>

          {!hasAnyProvider && (
            <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="font-semibold">No sign-in provider configured</p>
              <p className="mt-1 text-xs leading-5 opacity-80">
                Set <code className="rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900/50">GOOGLE_CLIENT_ID</code> /{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900/50">GOOGLE_CLIENT_SECRET</code> or{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900/50">GITHUB_ID</code> /{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900/50">GITHUB_SECRET</code> in your{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900/50">.env</code>. See{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900/50">.env.example</code>.
              </p>
            </div>
          )}

          {hasAnyProvider && (
            <div className="mt-8 space-y-3">
              {hasGoogle && (
                <form action={signInWithGoogle}>
                  <Button type="submit" className="w-full" size="lg" variant="default">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://www.svgrepo.com/show/475656/google-color.svg"
                      alt=""
                      width={18}
                      height={18}
                      className="mr-2 size-[18px] bg-white rounded-full p-0.5"
                    />
                    Continue with Google
                  </Button>
                </form>
              )}
              {hasGitHub && (
                <form action={signInWithGitHub}>
                  <Button type="submit" className="w-full" size="lg" variant="outline">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="mr-2 size-[18px] fill-current"
                    >
                      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.11.793-.26.793-.577v-2.165c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.73.083-.73 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.468-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                    </svg>
                    Continue with GitHub
                  </Button>
                </form>
              )}

              {hasOAuth && hasResend && (
                <div className="flex items-center gap-3 py-1">
                  <Separator className="flex-1" />
                  <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    or
                  </span>
                  <Separator className="flex-1" />
                </div>
              )}

              {hasResend && (
                <form action={sendMagicLink} className="space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-medium">
                      Work email
                    </label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@company.com"
                    />
                  </div>

                  <Button type="submit" className="w-full" size="lg" variant={hasOAuth ? "outline" : "default"}>
                    Send magic link <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Footer */}
          <p className="mt-10 text-xs text-center text-muted-foreground">
            By continuing, you agree to our{" "}
            <a href="/legal/terms" className="underline underline-offset-2">
              Terms
            </a>{" "}
            and{" "}
            <a href="/legal/privacy" className="underline underline-offset-2">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>

      {/* Right panel — Testimonial / Brand */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-10 bg-lime-50 dark:bg-black/40 border-l-2 relative overflow-hidden">
        <FlickeringGrid
          className="absolute inset-0 z-0 mask-[radial-gradient(650px_circle_at_center,transparent,white)] pointer-events-none"
          squareSize={2}
          gridGap={6}
          color="#83BE3C"
          maxOpacity={0.6}
          flickerChance={0.1}
        />
        <div className="w-full max-w-md">
          {/* Stars */}
          <div className="flex items-center gap-1 mb-6">
            {[...Array(5)].map((_, i) => (
              <StarIcon
                key={i}
                size={26}
                weight="fill"
                className="text-yellow-400 hover:scale-130 transition-all duration-300"
              />
            ))}
          </div>

          {/* Quote */}
          <blockquote className="text-xl md:text-2xl font-medium leading-snug tracking-tight">
            &ldquo;OpenInstaDM works so well that we were able to automate our Comment-to-DM workflow in just a
            few hours! Bye bye expensive manychat!&rdquo;
          </blockquote>

          {/* Author */}
          <div className="mt-8 flex items-center gap-3">
            <div className="size-10 rounded-full overflow-hidden bg-linear-to-tr from-yellow-400 to-rose-500"></div>
            <div>
              <p className="text-sm">Anish Biswas</p>
              <p className="text-xs font-light">Founder @AuraDevs</p>
            </div>
          </div>

          {/* Partner logos */}
          <div className="mt-14 px-2 italic text-xl font-bold tracking-tighter shimmer">
            Loved by 150+ creators and brands worldwide!
          </div>
        </div>
      </div>
    </div>
  );
}
