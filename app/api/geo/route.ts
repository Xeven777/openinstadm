import { NextResponse } from "next/server";
import { getCountryFromHeaders, getPricingForCountry } from "@/lib/geo-pricing";

export async function GET(request: Request) {
  const headers = request.headers as unknown as Headers;
  const country = getCountryFromHeaders(headers);
  const pricing = getPricingForCountry(country);
  return NextResponse.json(
    { country: country ?? null, pricing },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        Vary: "x-vercel-ip-country, cf-ipcountry",
      },
    }
  );
}
