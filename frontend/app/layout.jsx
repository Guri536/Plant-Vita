    import "./globals.css";

    export const metadata = {
      title: "PlantVita",
      description: "Monitor plant health intelligently",
    };

    import Providers from "./providers";

    export default function RootLayout({ children }) {
      return (
        <html lang="en">
          <body className="antialiased">
            <Providers>{children}</Providers>
          </body>
        </html>
      );
    }
