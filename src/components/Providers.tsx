"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/misc";
import { PasswordDialog } from "@/components/PasswordDialog";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  // Сверху под шапкой: внизу уведомление закрывало бы главную кнопку инструмента
  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      richColors
      position="top-center"
      offset={{ top: 72 }}
      mobileOffset={{ top: 64 }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={300}>
        {children}
        <PasswordDialog />
        <ThemedToaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
