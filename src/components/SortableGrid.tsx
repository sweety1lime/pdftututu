"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
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
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface Props<T extends { id: string }> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

/** Сетка карточек, которые можно переставлять мышкой или клавиатурой. */
export function SortableGrid<T extends { id: string }>({ items, onReorder, renderItem, className }: Props<T>) {
  const sensors = useSensors(
    // Небольшой порог, чтобы клики по кнопкам внутри карточки не начинали перетаскивание
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5", className)}>
          {items.map((item, index) => (
            <SortableCell key={item.id} id={item.id}>
              {renderItem(item, index)}
            </SortableCell>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableCell({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("touch-none", isDragging && "z-10 opacity-80")}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
