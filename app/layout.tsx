import { ClerkProvider } from '@clerk/nextjs';
import { FlowbaseLiveblocksProvider } from '@/components/liveblocks-provider';
import "./globals.css";
import "@liveblocks/react-ui/styles.css";
import "@excalidraw/excalidraw/index.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flowbase - AI-Powered Productivity Workspace",
  description:
    "Flowbase brings notes, tasks, whiteboards, calendar planning, AI templates, and real-time collaboration into one modern productivity workspace.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body style={{ margin: 0, padding: 0 }} suppressHydrationWarning>
          <FlowbaseLiveblocksProvider>{children}</FlowbaseLiveblocksProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
