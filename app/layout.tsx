import { ClerkProvider } from '@clerk/nextjs';
import { SyncUser } from '@/components/sync-user';
import { FlowbaseLiveblocksProvider } from '@/components/liveblocks-provider';
import "./globals.css";
import "@liveblocks/react-ui/styles.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Next.js Premium Startup Boilerplate",
  description: "Created using the ultimate interactive Next.js stack generator CLI.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body style={{ margin: 0, padding: 0 }}>
          <SyncUser />
          <FlowbaseLiveblocksProvider>{children}</FlowbaseLiveblocksProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
