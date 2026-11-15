import "@/app/globals.css";
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";

const dmSans = DM_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Burble — make room for good conversation",
	description: "A calm, capable space for your people and your ideas.",
	openGraph: { type: "website", title: "Burble" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return <html lang="en"><body className={dmSans.className}>{children}</body></html>;
}
