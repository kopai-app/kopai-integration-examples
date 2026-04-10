export const metadata = {
  title: "DevCon Store",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "2rem", background: "#fafafa" }}>
        {children}
      </body>
    </html>
  );
}
