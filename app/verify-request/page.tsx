import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { MailboxIcon } from "@phosphor-icons/react/dist/ssr";

export const metadata = {
  title: "Check your email - OpenInstaDM",
  description: "A sign-in link was sent to your email.",
};

export default function VerifyRequestPage() {
  // Hide completely when Resend is not configured — magic links are disabled.
  if (!process.env.RESEND_API_KEY) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center px-6 lg:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Image
              src="/logo3.svg"
              width={36}
              height={40}
              alt="OpenInstaDM"
              className="h-9 w-auto mx-auto"
            />
          </div>

          <div className="text-center mb-8 lg:mb-10">
            <h1 className="text-3xl font-semibold tracking-tight">Check your email</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              We&apos;ve sent a secure sign-in link to your inbox. Open it on this device to continue.
            </p>
          </div>

          <Card>
            <CardContent>
              <div className="mb-6 flex items-center justify-center">
                <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <MailboxIcon className="h-8 w-8 text-primary" />
                </div>
              </div>

              <p className="text-sm text-muted-foreground text-center">Didn&apos;t receive it? Check your spam folder, or</p>

              <Link
                href="/login"
                className="block w-full text-center text-sm font-medium text-primary hover:underline transition-colors"
              >
                Try another sign-in method
              </Link>

              <p className="mt-4 text-xs text-center text-muted-foreground">The link expires in 24 hours for security.</p>
            </CardContent>
          </Card>

          <p className="mt-8 text-xs text-center text-muted-foreground">
            By continuing, you agree to our{" "}
            <Link href="/legal/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
