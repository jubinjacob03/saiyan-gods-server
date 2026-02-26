import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

async function checkGuildMembership(accessToken: string): Promise<boolean> {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    console.warn("DISCORD_GUILD_ID not set, skipping guild check");
    return true;
  }

  try {
    // Get user's guilds from Discord API
    const response = await fetch(
      "https://discord.com/api/v10/users/@me/guilds",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      console.error("Failed to fetch user guilds:", response.statusText);
      return false;
    }

    const guilds = await response.json();
    return guilds.some((guild: any) => guild.id === guildId);
  } catch (error) {
    console.error("Error checking guild membership:", error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Error exchanging code for session:", error);
      return NextResponse.redirect(
        new URL("/login?error=auth_failed", requestUrl.origin),
      );
    }

    // Check guild membership using the provider token
    if (data.session?.provider_token) {
      const isMember = await checkGuildMembership(data.session.provider_token);

      if (!isMember) {
        // Sign out the user
        await supabase.auth.signOut();
        return NextResponse.redirect(
          new URL("/login?error=not_member", requestUrl.origin),
        );
      }
    }
  }

  // Redirect to home page after successful login
  return NextResponse.redirect(new URL("/", requestUrl.origin));
}
