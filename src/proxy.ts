import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
	// Keep bookmarks from the original clone from landing on an orphaned page.
	if (["/servers", "/invite", "/rome", "/sign-in", "/sign-up"].some((path) => request.nextUrl.pathname.startsWith(path))) {
		return NextResponse.redirect(new URL("/", request.url));
	}
	return updateSession(request);
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
