import "./globals.css";

export const metadata = {
  title: "Next.js Vercel OTel Example",
  description: "OpenTelemetry with @vercel/otel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
