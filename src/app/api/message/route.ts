import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, body }: { sessionId: string; body: string } =
    await request.json();

  if (!body.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const { error } = await supabase.from("messages").insert({
    session_id: sessionId,
    user_id: user.id,
    body: body.trim(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
