import "./globals.css";

export const metadata = {
  title: "Maas Maliyet Hesaplama",
  description: "Excel yukleyip normal veya SGDP personel maas maliyeti hesaplama araci",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
