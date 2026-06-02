import "./globals.css";

export const metadata = {
  title: "Marathon Skills",
  description: "Регистрация участников марафона с Google OAuth и PostgreSQL"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
