import { connection } from "next/server";
import NextAuth, { type NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/client";
import { ensureWorkspaceForUser } from "@/lib/workspace";
import { sendVerificationRequest } from "@/lib/server/magic-link-email";

type AdapterPrismaClient = Parameters<typeof PrismaAdapter>[0];

export const hasResend = !!process.env.RESEND_API_KEY;
const hasGoogle =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
const githubId = process.env.GITHUB_ID ?? process.env.GITHUB_CLIENT_ID;
const githubSecret =
  process.env.GITHUB_SECRET ?? process.env.GITHUB_CLIENT_SECRET;
const hasGitHub = !!githubId && !!githubSecret;

function buildProviders(): NextAuthConfig["providers"] {
  const providers: NextAuthConfig["providers"] = [];
  if (hasGoogle) {
    providers.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        authorization: {
          params: {
            prompt: "consent",
            access_type: "offline",
            response_type: "code",
          },
        },
      })
    );
  }
  if (hasGitHub) {
    providers.push(
      GitHub({
        clientId: githubId!,
        clientSecret: githubSecret!,
      })
    );
  }
  if (hasResend) {
    providers.push(
      Resend({
        apiKey: process.env.RESEND_API_KEY!,
        from: process.env.EMAIL_FROM ?? "OpenInstaDM <login@example.com>",
        sendVerificationRequest,
      })
    );
  }
  // Allow boot even if no provider is configured — /login will show a setup hint.
  // This keeps local dev and CI from crashing when env is still being wired.
  return providers;
}

export const authConfig = {
  adapter: PrismaAdapter(prisma as unknown as AdapterPrismaClient),
  providers: buildProviders(),
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in, embed the user ID and name in the JWT so session lookups never
      // touch the database (JWT strategy validates the HMAC signature
      // locally instead of querying the Session table).
      if (user?.id) {
        token.id = user.id;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string | undefined;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        await ensureWorkspaceForUser(user.id, user.email);
      }
    },
  },
  pages: {
    signIn: "/login",
    ...(hasResend ? { verifyRequest: "/verify-request" } : {}),
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export async function getCurrentUserId(): Promise<string | null> {
  await connection();
  const session = await auth();
  return session?.user?.id ?? null;
}


