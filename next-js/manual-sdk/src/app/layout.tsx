import "./globals.css";
import OtelProvider from "./otel-provider";

export const metadata = {
  title: "Next.js Manual SDK Example",
  description: "OpenTelemetry with manual SDK setup",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 antialiased">
        <OtelProvider>{children}</OtelProvider>
      </body>
    </html>
  );
}
