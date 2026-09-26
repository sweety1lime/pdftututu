"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Ellipse, Group, Image as KImage, Layer, Line, Rect, Shape, Stage, Transformer } from "react-konva";
import type Konva from "konva";
import { useShallow } from "zustand/react/shallow";
import { alignOffset, baselineOffset, cssFont, splitLines } from "@/lib/pdf/textLayout";
import { arrowHeadPoints } from "./exportPdf";
import { useAssetImage } from "./assets";
import { makeBox, makeStroke, makeText, ONE_SHOT_TOOLS, scaleObject } from "./factory";
import { beginGesture, endGesture, useEditor } from "./store";
import type { EditorObject, StrokeObject, TextObject } from "./types";

const DRAW_TOOLS = new Set(["rect", "ellipse", "highlight", "whiteout", "line", "arrow", "pen"]);
const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];
const ALL_ANCHORS = [...CORNERS, "top-center", "bottom-center", "middle-left", "middle-right"];

let endTimer: ReturnType<typeof setTimeout> | undefined;
/** Несколько узлов шлют dragend/transformend подряд — закрываем жест один раз. */
function scheduleEndGesture() {
  clearTimeout(endTimer);
  endTimer = setTimeout(endGesture, 0);
}

interface Props {
  pageIndex: number;
  width: number;
  height: number;
  zoom: number;
  /** Счётчик загрузки шрифтов — чтобы перерисовать текст, когда шрифты готовы */
  fontsVersion: number;
}

type Draft = { kind: "box" | "stroke"; start: { x: number; y: number }; obj: EditorObject } | null;

export function ObjectsLayer({ pageIndex, width, height, zoom, fontsVersion }: Props) {
  const objects = useEditor(useShallow((s) => s.objects.filter((o) => o.page === pageIndex)));
  const selectedIds = useEditor((s) => s.selectedIds);
  const tool = useEditor((s) => s.tool);
  const editingTextId = useEditor((s) => s.editingTextId);

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const nodes = useRef(new Map<string, Konva.Group>());
  const [draft, setDraftState] = useState<Draft>(null);
  // Ref — для обработчиков window (pointermove), state — для отрисовки
  const draftRef = useRef<Draft>(null);
  const setDraft = (d: Draft) => {
    draftRef.current = d;
    setDraftState(d);
  };

  // Трансформер — на выделенные объекты этой страницы
  const selectedHere = objects.filter((o) => selectedIds.includes(o.id) && o.id !== editingTextId);
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    tr.nodes(selectedHere.map((o) => nodes.current.get(o.id)).filter((n): n is Konva.Group => Boolean(n)));
    tr.getLayer()?.batchDraw();
  });

  useEffect(() => {
    layerRef.current?.batchDraw();
  }, [fontsVersion]);

  const pointer = () => stageRef.current?.getRelativePointerPosition() ?? { x: 0, y: 0 };

  const register = useCallback((id: string) => (node: Konva.Group | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);

  // ---- Рисование новых объектов ----
  const startDraw = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const s = useEditor.getState();
    const p = pointer();
    if (s.tool === "text") {
      const obj = makeText(pageIndex, p.x, p.y, s.defaults);
      // Создание + ввод текста = один шаг истории (жест закроет TextEditOverlay)
      beginGesture();
      s.setTool("select");
      s.addObject(obj);
      useEditor.setState({ selectedIds: [obj.id], editingTextId: obj.id });
      return;
    }
    if (!DRAW_TOOLS.has(s.tool)) return;
    e.evt.preventDefault();
    let d: Draft;
    if (s.tool === "line" || s.tool === "arrow" || s.tool === "pen") {
      const type = s.tool === "pen" ? "path" : s.tool;
      d = { kind: "stroke", start: p, obj: makeStroke(type, pageIndex, [p.x, p.y, p.x, p.y], s.defaults) };
    } else {
      d = {
        kind: "box",
        start: p,
        obj: makeBox(s.tool as "rect", pageIndex, { x: p.x, y: p.y, w: 0, h: 0 }, s.defaults),
      };
    }
    setDraft(d);

    const stage = stageRef.current!;
    const absPoints = [p.x, p.y];
    const onMove = (ev: PointerEvent) => {
      stage.setPointersPositions(ev);
      const q = stage.getRelativePointerPosition() ?? p;
      const cur = draftRef.current;
      if (!cur) return;
      const st = useEditor.getState();
      if (cur.kind === "box") {
        const x = Math.min(cur.start.x, q.x);
        const y = Math.min(cur.start.y, q.y);
        setDraft({ ...cur, obj: { ...cur.obj, x, y, w: Math.abs(q.x - cur.start.x), h: Math.abs(q.y - cur.start.y) } });
      } else if (cur.obj.type === "path") {
        const lx = absPoints[absPoints.length - 2];
        const ly = absPoints[absPoints.length - 1];
        if (Math.hypot(q.x - lx, q.y - ly) < 1.2 / zoom) return;
        absPoints.push(q.x, q.y);
        setDraft({ ...cur, obj: makeStroke("path", pageIndex, absPoints, st.defaults) });
      } else {
        let { x, y } = q;
        if (ev.shiftKey) {
          // Shift — шаг 45°
          const ang = Math.round(Math.atan2(y - p.y, x - p.x) / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(x - p.x, y - p.y);
          x = p.x + Math.cos(ang) * len;
          y = p.y + Math.sin(ang) * len;
        }
        setDraft({ ...cur, obj: { ...makeStroke(cur.obj.type as "line", pageIndex, [p.x, p.y, x, y], st.defaults), id: cur.obj.id } });
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const cur = draftRef.current;
      setDraft(null);
      if (!cur) return;
      const st = useEditor.getState();
      let obj = cur.obj;
      if (cur.kind === "box" && obj.w < 3 && obj.h < 3) {
        // Просто клик — объект стандартного размера
        const size =
          obj.type === "highlight" ? { w: 140, h: 16 } : obj.type === "whiteout" ? { w: 120, h: 24 } : { w: 120, h: 80 };
        obj = { ...obj, x: cur.start.x - size.w / 2, y: cur.start.y - size.h / 2, ...size };
      }
      if (obj.type === "line" || obj.type === "arrow") {
        const [x1, y1, x2, y2] = (obj as StrokeObject).points;
        if (Math.hypot(x2 - x1, y2 - y1) < 3) return;
      }
      st.addObject(obj, { select: obj.type !== "path" });
      if (ONE_SHOT_TOOLS.has(st.tool)) st.setTool("select");
      if (obj.type !== "path") useEditor.setState({ selectedIds: [obj.id] });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onStagePointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const s = useEditor.getState();
    if (s.currentPage !== pageIndex) s.setCurrentPage(pageIndex);
    if (s.tool === "select") {
      if (e.target === stageRef.current && !e.evt.shiftKey) s.select([]);
      return;
    }
    startDraw(e);
  };

  const onObjectPointerDown = (e: Konva.KonvaEventObject<PointerEvent>, id: string) => {
    const s = useEditor.getState();
    if (s.tool !== "select") return; // пусть событие уйдёт на Stage и начнётся рисование
    e.cancelBubble = true;
    if (s.currentPage !== pageIndex) s.setCurrentPage(pageIndex);
    if (e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey) {
      s.select([id], true);
    } else if (!s.selectedIds.includes(id)) {
      s.select([id]);
    }
  };

  const onTransformEnd = (o: EditorObject) => {
    const node = nodes.current.get(o.id);
    if (!node) return;
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const current = useEditor.getState().objects.find((x) => x.id === o.id) ?? o;
    useEditor.getState().updateObject(o.id, {
      x: node.x(),
      y: node.y(),
      rotation: Math.round(node.rotation() * 100) / 100,
      ...scaleObject(current, sx, sy),
    });
    scheduleEndGesture();
  };

  const selTypes = new Set(selectedHere.map((o) => o.type));
  const onlyText = selTypes.size === 1 && selTypes.has("text");
  const keepRatio = [...selTypes].every((t) => t === "text" || t === "image");

  const cursor =
    tool === "text" ? "text" : DRAW_TOOLS.has(tool) ? "crosshair" : undefined;

  return (
    <Stage
      ref={stageRef}
      width={width * zoom}
      height={height * zoom}
      scaleX={zoom}
      scaleY={zoom}
      onPointerDown={onStagePointerDown}
      className="absolute inset-0"
      style={{ cursor }}
    >
      <Layer ref={layerRef}>
        {objects.map((o) => (
          <Group
            key={o.id}
            ref={register(o.id)}
            x={o.x}
            y={o.y}
            rotation={o.rotation}
            visible={o.id !== editingTextId}
            draggable={tool === "select"}
            onPointerDown={(e) => onObjectPointerDown(e, o.id)}
            onDblClick={() => o.type === "text" && useEditor.getState().setEditingText(o.id)}
            onDblTap={() => o.type === "text" && useEditor.getState().setEditingText(o.id)}
            onDragStart={beginGesture}
            onDragEnd={(e) => {
              useEditor.getState().updateObject(o.id, { x: e.target.x(), y: e.target.y() });
              scheduleEndGesture();
            }}
            onTransformStart={beginGesture}
            onTransformEnd={() => onTransformEnd(o)}
          >
            <ObjectShape o={o} />
          </Group>
        ))}
        {draft && (
          <Group x={draft.obj.x} y={draft.obj.y} listening={false}>
            <ObjectShape o={draft.obj} />
          </Group>
        )}
        <Transformer
          ref={trRef}
          rotateEnabled
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          rotationSnapTolerance={4}
          keepRatio={keepRatio}
          enabledAnchors={onlyText ? CORNERS : ALL_ANCHORS}
          flipEnabled={false}
          ignoreStroke
          anchorSize={9}
          anchorCornerRadius={3}
          borderStroke="#3b82f6"
          anchorStroke="#3b82f6"
          boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 4 || Math.abs(newBox.height) < 4 ? oldBox : newBox)}
        />
      </Layer>
    </Stage>
  );
}

const ObjectShape = memo(function ObjectShape({ o }: { o: EditorObject }) {
  switch (o.type) {
    case "rect":
    case "whiteout":
    case "highlight":
      return (
        <Rect
          width={o.w}
          height={o.h}
          fill={o.fill ?? "rgba(0,0,0,0)"}
          stroke={o.stroke ?? undefined}
          strokeWidth={o.stroke ? o.strokeWidth : 0}
          strokeScaleEnabled={false}
          opacity={o.opacity}
          globalCompositeOperation={o.type === "highlight" ? "multiply" : undefined}
        />
      );
    case "ellipse":
      return (
        <Ellipse
          x={o.w / 2}
          y={o.h / 2}
          radiusX={o.w / 2}
          radiusY={o.h / 2}
          fill={o.fill ?? "rgba(0,0,0,0)"}
          stroke={o.stroke ?? undefined}
          strokeWidth={o.stroke ? o.strokeWidth : 0}
          strokeScaleEnabled={false}
          opacity={o.opacity}
        />
      );
    case "image":
      return <ImageShape assetId={o.assetId} w={o.w} h={o.h} opacity={o.opacity} />;
    case "text":
      return <TextShape o={o} />;
    case "line":
    case "arrow":
    case "path":
      return <StrokeShape o={o} />;
  }
});

function ImageShape({ assetId, w, h, opacity }: { assetId: string; w: number; h: number; opacity: number }) {
  const asset = useEditor((s) => s.assets[assetId]);
  const img = useAssetImage(asset);
  if (!img) return <Rect width={w} height={h} fill="rgba(128,128,128,0.15)" />;
  return <KImage image={img} width={w} height={h} opacity={opacity} />;
}

function TextShape({ o }: { o: TextObject }) {
  return (
    <Shape
      width={o.w}
      height={o.h}
      opacity={o.opacity}
      sceneFunc={(ctx) => {
        const c = ctx._context as CanvasRenderingContext2D;
        c.font = cssFont(o);
        c.fillStyle = o.color;
        c.textBaseline = "alphabetic";
        if ("fontKerning" in c) c.fontKerning = "none";
        const lines = splitLines(o.text);
        lines.forEach((line, i) => {
          const lw = c.measureText(line).width;
          c.fillText(line, alignOffset(o.align, o.w, lw), baselineOffset(o, i));
        });
      }}
      hitFunc={(ctx, shape) => {
        ctx.beginPath();
        ctx.rect(0, 0, o.w, o.h);
        ctx.closePath();
        ctx.fillStrokeShape(shape);
      }}
    />
  );
}

function StrokeShape({ o }: { o: StrokeObject }) {
  const pts = o.points.length === 2 ? [...o.points, ...o.points] : o.points;
  const n = pts.length;
  const head =
    o.type === "arrow" ? arrowHeadPoints(pts[n - 4], pts[n - 3], pts[n - 2], pts[n - 1], o.strokeWidth) : null;
  return (
    <>
      <Line
        points={pts}
        stroke={o.stroke}
        strokeWidth={o.strokeWidth}
        lineCap="round"
        lineJoin="round"
        opacity={o.opacity}
        hitStrokeWidth={Math.max(12, o.strokeWidth)}
        strokeScaleEnabled={false}
        globalCompositeOperation={o.marker ? "multiply" : undefined}
      />
      {head && <Line points={head} closed fill={o.stroke} opacity={o.opacity} strokeEnabled={false} />}
    </>
  );
}
