import "./globals.css";

export const metadata = {
  title: "EcoRoute Planner",
  description: "AI-based eco-friendly route optimization",
  icons: {
    icon: "/ecorouter-logo.png",
    apple: "/apple-touch-icon.png"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
