import Link from "next/link";
import Image from "next/image";
import { ArrowLeftIcon, HouseIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Page not found - OpenInstaDM",
  description: "The page you're looking for doesn't exist.",
};

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex">
      {/* Right panel - 404 */}
      <div className="flex-1 flex items-center justify-center px-6 lg:px-12">
        <div className="w-full max-w-sm text-center">
          <div className="mb-10 lg:hidden">
            <Image
              src="/logo3.svg"
              width={36}
              height={40}
              alt="OpenInstaDM"
              className="h-9 w-auto mx-auto"
            />
          </div>

          <div className="mb-8">
            <div className="inline-flex items-center justify-center mb-6">
              <span className="text-4xl md:text-8xl font-bold tracking-tighter">
                404
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Page not found
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Sorry, we couldn&apos;t find the page you&apos;re looking for. It
              might have been moved or doesn&apos;t exist.
            </p>
          </div>

          <div className="flex justify-center  items-center gap-3">
            <Link href="/">
              <Button>
                <HouseIcon className="h-4 w-4" aria-hidden="true" />
                Go to Dashboard
              </Button>
            </Link>
            <Link href="/">
              <Button variant="link" className="text-sm text-muted-foreground">
                <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
                Back to Home
              </Button>
            </Link>
          </div>
          <p className="mt-10 text-xs text-center text-muted-foreground">
            <Link
              href="/legal/terms"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Terms
            </Link>{" "}
            ·{" "}
            <Link
              href="/legal/privacy"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
