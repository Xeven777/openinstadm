import { Suspense } from "react";
import { signIn } from "@/lib/auth";
import { getCampaignTemplate } from "@/lib/templates/campaign-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
          <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {selectedTemplate
              ? `Sign in to use the ${selectedTemplate.title} template.`
              : "Sign in by email, then connect your Instagram professional account."}
          </p>

          {/* Form */}
          <form action={sendMagicLink} className="mt-8 space-y-3">
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

            <Button
              type="submit"
              className="w-full"
              size={"lg"}
              variant={"default"}
            >
              Send magic link <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Button>
          </form>

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
      <div className="hidden lg:flex flex-1 items-center justify-center p-10 bg-black/40 border-l-2 relative overflow-hidden">
        <FlickeringGrid
          className="absolute inset-0 z-0 mask-[radial-gradient(650px_circle_at_center,transparent,white)] pointer-events-none"
          squareSize={2}
          gridGap={6}
          color="#83BE3C"
          maxOpacity={0.5}
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
            &ldquo;OpenInstaDM works so well that we were able to automate our
            Comment-to-DM workflow in just a few hours! Bye bye expensive
            manychat!&rdquo;
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
