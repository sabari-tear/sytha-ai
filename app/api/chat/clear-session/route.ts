import { NextResponse } from "next/server";
import { clearUserSessions } from "@/lib/chat-session";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = body?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required." },
        { status: 400 }
      );
    }

    await clearUserSessions(userId);

    apiLogger.info("Cleared user chat sessions", { userId });

    return NextResponse.json({ 
      success: true,
      message: "Chat sessions cleared successfully" 
    });
  } catch (error) {
    apiLogger.error("Failed to clear chat sessions", { error: String(error) });
    
    return NextResponse.json(
      { error: "Failed to clear chat sessions" },
      { status: 500 }
    );
  }
}
