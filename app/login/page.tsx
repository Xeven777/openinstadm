import { Suspense } from "react";
import { signIn } from "@/lib/auth";
import { getCampaignTemplate } from "@/lib/templates/campaign-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Login - OpenInstaDM",
  description: "Sign in to manage Instagram comment-to-DM campaigns.",
};

type LoginSearchParams = Promise<{
  checkEmail?: string;
  callbackUrl?: string;
  template?: string;
}>;

export default function LoginPage({ searchParams }: { searchParams: LoginSearchParams }) {
  return (
    // searchParams is only known at request time, so the login form streams
    // inside a Suspense boundary under cacheComponents.
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
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground">
            OpenInstaDM
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mt-2">
            {selectedTemplate
              ? `Sign in to use the ${selectedTemplate.title} template.`
              : "Sign in by email, then connect your Instagram professional account."}
          </p>
        </div>

        <Card>
          <CardContent>
            {selectedTemplate && !checkEmail && (
              <div className="mb-5 border border-accent/20 bg-accent/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                  Template selected
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {selectedTemplate.title}
                </p>
              </div>
            )}

            {checkEmail ? (
              <div className="text-center py-4">
                <h2 className="text-lg font-semibold mb-2">Check your email</h2>
                <p className="text-sm text-muted-foreground">
                  We sent you a secure sign-in link. Open it on this device to
                  continue.
                </p>
              </div>
            ) : (
              <form action={sendMagicLink} className="space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-foreground"
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
                  />
                </div>

                <Button type="submit">Email me a magic link</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
