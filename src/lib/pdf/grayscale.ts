/**
 * Чёрно-белый PDF без превращения страниц в картинки.
 *
 * Поверх каждой страницы рисуется серый прямоугольник в режиме наложения
 * Saturation: у результата насыщенность берётся от нейтрального серого (ноль),
 * а яркость — от того, что под ним. Страница выглядит серой, при этом текст
 * остаётся текстом, векторы — векторами, размер файла почти не меняется.
 * Комментарии (аннотации) рисуются поверх страницы и цвет сохраняют.
 */
import {
  fill,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  setFillingGrayscaleColor,
  setGraphicsState,
} from "@cantoo/pdf-lib";
import { loadForEdit } from "./load";

export async function toGrayscale(bytes: Uint8Array, opts: { pages?: number[] } = {}): Promise<Uint8Array> {
  const doc = await loadForEdit(bytes);
  const ctx = doc.context;
  // В перечислении BlendMode у pdf-lib нет Saturation — описываем состояние сами
  const gs = ctx.register(ctx.obj({ Type: "ExtGState", BM: "Saturation" }));
  const all = doc.getPages();
  const targets = (opts.pages ?? all.map((_, i) => i)).filter((i) => i >= 0 && i < all.length);

  for (const i of targets) {
    const page = all[i];
    const key = page.node.newExtGState("GS", gs);
    // MediaBox — вся страница, что бы ни было в CropBox и повороте
    const { x, y, width, height } = page.getMediaBox();
    page.pushOperators(
      pushGraphicsState(),
      setGraphicsState(key),
      setFillingGrayscaleColor(0.5),
      rectangle(x, y, width, height),
      fill(),
      popGraphicsState(),
    );
  }
  return doc.save();
}
