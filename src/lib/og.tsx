import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createElement } from "react";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { FileText, type LucideIcon } from "lucide-react";
import { getTool, type ToolId } from "@/lib/tools";

/**
 * Картинки для превью ссылок (Telegram, VK, соцсети). Рисуются при сборке —
 * в каждой папке страницы лежит opengraph-image.tsx, который вызывает ogImage().
 */
export const OG_SIZE = { width: 1200, height: 630 };

const PRIMARY = "#2663e7";
const FOREGROUND = "#0f1522";
const MUTED = "#5f6573";

// Tailwind-600 для акцентов плиток (tools.ts: "text-sky-600 …")
const ACCENT: Record<string, string> = {
  sky: "#0284c7",
  slate: "#475569",
  blue: "#2563eb",
  cyan: "#0891b2",
  indigo: "#4f46e5",
  violet: "#7c3aed",
  fuchsia: "#c026d3",
  emerald: "#059669",
  teal: "#0d9488",
  green: "#16a34a",
  amber: "#d97706",
  orange: "#ea580c",
  yellow: "#ca8a04",
  rose: "#e11d48",
  red: "#dc2626",
  pink: "#db2777",
};

type IconNode = [tag: string, attrs: Record<string, string>][];

/**
 * Иконки lucide-react — клиентские компоненты, Satori не может их вызвать.
 * Внешняя обёртка иконки (forwardRef) только создаёт элемент с данными SVG
 * в props.icon — достаём их и рисуем <svg> сами.
 */
function LucideSvg({ icon, size, color }: { icon: LucideIcon; size: number; color: string }) {
  type Render = (props: object, ref: null) => { props: { icon: { node: IconNode } } };
  const render = (typeof icon === "function" ? icon : (icon as unknown as { render: Render }).render) as Render;
  const nodes = render({}, null).props.icon.node;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {nodes.map(([tag, { key, ...attrs }]) => createElement(tag, { key, ...attrs }))}
    </svg>
  );
}

// Кириллицу встроенный шрифт Satori не умеет — берём наш PT Sans
const font = (file: string) => readFile(join(process.cwd(), "public", "fonts", file));

/** @param id — инструмент; без него — картинка главной */
export async function ogImage(locale: string, id?: ToolId) {
  const t = await getTranslations({ locale });
  const tool = id ? getTool(id) : null;
  const accent = (tool && ACCENT[/text-(\w+)-600/.exec(tool.accent)?.[1] ?? ""]) || PRIMARY;
  const Icon = tool?.icon ?? FileText;
  const title = id ? t(`tools.${id}.title`) : t("home.title");
  const description = id ? t(`tools.${id}.description`) : t("home.subtitle");
  const features = [t("home.feature1"), t("home.feature2"), t("home.feature3")];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          fontFamily: "PT Sans",
          color: FOREGROUND,
          backgroundColor: "#ffffff",
          backgroundImage: "linear-gradient(160deg, #e9efff 0%, #ffffff 55%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: PRIMARY,
            }}
          >
            <LucideSvg icon={FileText} size={36} color="#ffffff" />
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>{t("meta.siteName")}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          {tool && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                width: 168,
                height: 168,
                borderRadius: 40,
                // Полупрозрачный акцент поверх белого, а не поверх градиента фона
                backgroundColor: "#ffffff",
                backgroundImage: `linear-gradient(${accent}1f, ${accent}1f)`,
              }}
            >
              <LucideSvg icon={Icon} size={92} color={accent} />
            </div>
          )}
          {/* Ширина задана явно — иначе Satori не переносит длинное описание */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, width: tool ? 840 : 1056 }}>
            <div style={{ fontSize: tool ? 76 : 64, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
            <div style={{ fontSize: 34, color: MUTED, lineHeight: 1.3 }}>{description}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {features.map((f) => (
            <div
              key={f}
              style={{
                display: "flex",
                padding: "10px 24px",
                borderRadius: 999,
                border: "2px solid #e3e6ee",
                backgroundColor: "#ffffff",
                fontSize: 26,
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "PT Sans", data: await font("PT_Sans-Web-Regular.ttf"), weight: 400 },
        { name: "PT Sans", data: await font("PT_Sans-Web-Bold.ttf"), weight: 700 },
      ],
    },
  );
}
