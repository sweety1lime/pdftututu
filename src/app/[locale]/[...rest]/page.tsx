import { notFound } from "next/navigation";

// Любой неизвестный адрес внутри /ru и /en — на 404 с шапкой сайта и переводом
export default function CatchAll() {
  notFound();
}
