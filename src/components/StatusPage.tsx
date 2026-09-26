/** Страница-заглушка для 404 и ошибок: крупная иконка, заголовок, текст, кнопки. */
export function StatusPage({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary [&_svg]:size-8">
        {icon}
      </span>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {description && <p className="text-muted-foreground">{description}</p>}
      <div className="mt-2 flex flex-wrap justify-center gap-3">{children}</div>
    </main>
  );
}
