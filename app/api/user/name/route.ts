import { getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { revalidateTag } from "next/cache";

const NAME_REGEX = /^[a-zA-Z0-9\s\-'.]{1,50}$/;

export async function PATCH(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let name: string;
  try {
    const body = await request.json();
    name = body.name?.trim();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!name) {
    return new Response(JSON.stringify({ error: "Name cannot be empty" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!NAME_REGEX.test(name)) {
    return new Response(
      JSON.stringify({
        error:
          "Name can only contain letters, numbers, spaces, hyphens, apostrophes, and periods (max 50 characters)",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { name },
    });

    revalidateTag("workspace-ctx", userId);

    return new Response(JSON.stringify({ success: true, name }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to update user name:", error);
    return new Response(JSON.stringify({ error: "Failed to update name" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}