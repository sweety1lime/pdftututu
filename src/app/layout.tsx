// Корневой layout нужен Next.js, но <html> рендерится в app/[locale]/layout.tsx,
// чтобы у каждой языковой версии был правильный lang.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
