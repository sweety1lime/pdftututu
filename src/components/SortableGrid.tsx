"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface Props<T extends { id: string }> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** list — строки во всю ширину одна под другой */
  layout?: "grid" | "list";
  className?: string;
}

/** Сетка карточек (или список строк), которые можно переставлять мышкой, пальцем или клавиатурой. */
export function SortableGrid<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  layout = "grid",
  className,
}: Props<T>) {
  const list = layout === "list";
  // Небольшой порог, чтобы клики по кнопкам внутри карточки не начинали перетаскивание
  const pointer = useSensor(PointerSensor, { activationConstraint: { distance: 6 } });
  const mouse = useSensor(MouseSensor, { activationConstraint: { distance: 6 } });
  // Строки списка занимают всю ширину: пальцем их берут долгим нажатием, иначе страницу не прокрутить
  const touch = useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } });
  const keyboard = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates });
  const sensors = useSensors(...(list ? [mouse, touch, keyboard] : [pointer, keyboard]));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={list ? verticalListSortingStrategy : rectSortingStrategy}
      >
        <div
          className={cn(
            list ? "flex flex-col gap-2.5" : "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
            className,
          )}
        >
          {items.map((item, index) => (
            <SortableCell key={item.id} id={item.id} touchScroll={list}>
              {renderItem(item, index)}
            </SortableCell>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableCell({ id, children, touchScroll }: { id: string; children: React.ReactNode; touchScroll?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(!touchScroll && "touch-none", isDragging && "relative z-10 opacity-80")}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
