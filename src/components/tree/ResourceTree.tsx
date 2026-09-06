"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderInput,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type TreeFolder = {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
  count: number;
};

export type TreeResource = {
  id: string;
  title: string;
  folderId: string | null;
  position: number;
  meta?: string;
};

type Props = {
  folders: TreeFolder[];
  resources: TreeResource[];
  resourceName: string;
  storageKey?: string;
  pending?: boolean;
  onMoveFolder: (id: string, parentId: string | null, position?: number) => void;
  onMoveResource: (id: string, folderId: string | null, position?: number) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
};

type DragData = { type: "folder" | "resource"; id: string };
type DropData =
  | { type: "root" }
  | { type: "inside-folder"; folderId: string }
  | { type: "folder-slot"; parentId: string | null; position: number }
  | { type: "resource-slot"; folderId: string | null; position: number };

function sortByPosition<T extends { position: number; title?: string; name?: string }>(items: T[]) {
  return [...items].sort((a, b) =>
    a.position - b.position || (a.title ?? a.name ?? "").localeCompare(b.title ?? b.name ?? "", "vi"),
  );
}

export function ResourceTree({
  folders,
  resources,
  resourceName,
  storageKey = `resource-tree:${resourceName}`,
  pending = false,
  onMoveFolder,
  onMoveResource,
  onRenameFolder,
  onDeleteFolder,
}: Props) {
  const dndContextId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [expanded, setExpanded] = useState(() => new Set(folders.map((folder) => folder.id)));
  const restoredExpansion = useRef(false);
  const childrenByParent = useMemo(() => {
    const result = new Map<string | null, TreeFolder[]>();
    for (const folder of folders) {
      const group = result.get(folder.parentId) ?? [];
      group.push(folder);
      result.set(folder.parentId, group);
    }
    for (const group of result.values()) group.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "vi"));
    return result;
  }, [folders]);
  const resourcesByFolder = useMemo(() => {
    const result = new Map<string | null, TreeResource[]>();
    for (const resource of resources) {
      const group = result.get(resource.folderId) ?? [];
      group.push(resource);
      result.set(resource.folderId, group);
    }
    for (const group of result.values()) result.set(group[0]?.folderId ?? null, sortByPosition(group));
    return result;
  }, [resources]);
  const folderChoices = useMemo(() => {
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    return folders.map((folder) => {
      const names = [folder.name];
      let parentId = folder.parentId;
      const seen = new Set<string>();
      while (parentId && !seen.has(parentId)) {
        seen.add(parentId);
        const parent = byId.get(parentId);
        if (!parent) break;
        names.unshift(parent.name);
        parentId = parent.parentId;
      }
      return { id: folder.id, label: names.join(" / "), parentId: folder.parentId };
    }).sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [folders]);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(storageKey); } catch { /* localStorage có thể bị chặn */ }
    const available = new Set(folders.map((folder) => folder.id));
    let ids = folders.map((folder) => folder.id);
    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) ids = parsed.filter((id): id is string => typeof id === "string" && available.has(id));
      } catch { /* Bỏ qua preference cũ bị hỏng */ }
    }
    const frame = window.requestAnimationFrame(() => {
      restoredExpansion.current = true;
      setExpanded(new Set(ids));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [folders, storageKey]);

  useEffect(() => {
    if (!restoredExpansion.current) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify([...expanded])); } catch { /* localStorage có thể bị chặn */ }
  }, [expanded, storageKey]);

  function toggle(folderId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const drag = event.active.data.current as DragData | undefined;
    const drop = event.over?.data.current as DropData | undefined;
    if (!drag || !drop) return;
    if (drop.type === "root") {
      if (drag.type === "folder") onMoveFolder(drag.id, null);
      else onMoveResource(drag.id, null);
      return;
    }
    if (drop.type === "inside-folder") {
      if (drag.type === "folder") onMoveFolder(drag.id, drop.folderId);
      else onMoveResource(drag.id, drop.folderId);
      setExpanded((current) => new Set(current).add(drop.folderId));
      return;
    }
    if (drag.type === "folder" && drop.type === "folder-slot") {
      onMoveFolder(drag.id, drop.parentId, drop.position);
    }
    if (drag.type === "resource" && drop.type === "resource-slot") {
      onMoveResource(drag.id, drop.folderId, drop.position);
    }
  }

  function renderLevel(parentId: string | null, depth: number) {
    const levelFolders = childrenByParent.get(parentId) ?? [];
    const levelResources = resourcesByFolder.get(parentId) ?? [];
    return (
      <div className={depth ? "ml-2 border-l border-navy-100 pl-1 sm:ml-6 sm:pl-2" : ""}>
        {levelFolders.map((folder, index) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            index={index}
            siblingCount={levelFolders.length}
            expanded={expanded.has(folder.id)}
            pending={pending}
            onToggle={() => toggle(folder.id)}
            onMove={(position) => onMoveFolder(folder.id, parentId, position)}
            moveTargets={folderChoices.filter((candidate) => {
              let cursor: string | null = candidate.id;
              const seen = new Set<string>();
              while (cursor && !seen.has(cursor)) {
                if (cursor === folder.id) return false;
                seen.add(cursor);
                cursor = folderChoices.find((item) => item.id === cursor)?.parentId ?? null;
              }
              return true;
            })}
            onMoveTo={(nextParentId) => onMoveFolder(folder.id, nextParentId)}
            onRename={() => {
              const name = window.prompt("Tên mới của thư mục", folder.name)?.trim();
              if (name && name !== folder.name) onRenameFolder(folder.id, name);
            }}
            onDelete={() => {
              if (window.confirm(`Xóa thư mục “${folder.name}”?`)) onDeleteFolder(folder.id);
            }}
          >
            {renderLevel(folder.id, depth + 1)}
          </FolderRow>
        ))}
        {levelResources.map((resource, index) => (
          <ResourceRow
            key={resource.id}
            resource={resource}
            index={index}
            siblingCount={levelResources.length}
            pending={pending}
            onMove={(position) => onMoveResource(resource.id, parentId, position)}
            moveTargets={folderChoices}
            onMoveTo={(folderId) => onMoveResource(resource.id, folderId)}
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext id={dndContextId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <RootDropZone resourceName={resourceName} disabled={pending} />
      <div className="mt-2 space-y-1">
        {renderLevel(null, 0)}
        {!folders.length && !resources.length && (
          <p className="rounded-2xl border border-dashed border-navy-100 px-4 py-8 text-center text-sm text-navy-300">
            Chưa có thư mục hoặc {resourceName}.
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-navy-300">
        Kéo vào vùng “Thả vào đây” để chuyển thư mục; kéo lên một dòng cùng loại để đổi thứ tự.
      </p>
    </DndContext>
  );
}

function RootDropZone({ resourceName, disabled }: { resourceName: string; disabled: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: "drop:root", data: { type: "root" } satisfies DropData, disabled });
  return (
    <div ref={setNodeRef} className={`flex min-w-0 items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-xs transition ${isOver ? "border-navy-500 bg-pastel-100 text-navy-600" : "border-navy-100 text-navy-300"}`}>
      <FolderInput className="size-4 shrink-0" /> <span className="min-w-0">Thả tại đây để chuyển về thư mục gốc ({resourceName})</span>
    </div>
  );
}

function FolderRow({
  folder,
  index,
  siblingCount,
  expanded,
  pending,
  onToggle,
  onMove,
  moveTargets,
  onMoveTo,
  onRename,
  onDelete,
  children,
}: {
  folder: TreeFolder;
  index: number;
  siblingCount: number;
  expanded: boolean;
  pending: boolean;
  onToggle: () => void;
  onMove: (position: number) => void;
  moveTargets: { id: string; label: string }[];
  onMoveTo: (parentId: string | null) => void;
  onRename: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id: `drag:folder:${folder.id}`, data: { type: "folder", id: folder.id } satisfies DragData, disabled: pending });
  const { setNodeRef: setSlotRef, isOver: isOverSlot } = useDroppable({ id: `slot:folder:${folder.id}`, data: { type: "folder-slot", parentId: folder.parentId, position: index } satisfies DropData, disabled: pending });
  const { setNodeRef: setInsideRef, isOver: isOverInside } = useDroppable({ id: `inside:folder:${folder.id}`, data: { type: "inside-folder", folderId: folder.id } satisfies DropData, disabled: pending });
  return (
    <div ref={setSlotRef} className={isOverSlot ? "rounded-xl ring-2 ring-navy-300" : ""}>
      <div
        ref={setDragRef}
        style={{ transform: CSS.Translate.toString(transform) }}
        className={`flex min-w-0 flex-wrap items-center gap-1 rounded-xl px-2 py-2 text-sm text-navy-500 ${isDragging ? "z-10 bg-white opacity-70 shadow-lg" : "bg-pastel-50"}`}
      >
        <button type="button" onClick={onToggle} className="flex size-11 items-center justify-center rounded hover:bg-white sm:size-7" aria-label={expanded ? "Thu gọn" : "Mở rộng"}>
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <button type="button" className="flex size-11 touch-none cursor-grab items-center justify-center rounded hover:bg-white active:cursor-grabbing sm:size-7" aria-label="Kéo thư mục" {...listeners} {...attributes}>
          <GripVertical className="size-4" />
        </button>
        <Folder className="size-4 shrink-0 fill-current text-amber-500" />
        <span className="min-w-0 flex-1 truncate font-medium">{folder.name}</span>
        <span className="text-[11px] text-navy-300">{folder.count}</span>
        <div ref={setInsideRef} className={`hidden rounded-lg border border-dashed px-2 py-1 text-[10px] sm:block ${isOverInside ? "border-navy-500 bg-white text-navy-600" : "border-navy-200 text-navy-300"}`}>
          Thả vào đây
        </div>
        <select aria-label={`Di chuyển thư mục ${folder.name}`} title="Di chuyển đến…" value={folder.parentId ?? ""} disabled={pending} onChange={(event) => onMoveTo(event.target.value || null)} className="min-h-11 w-24 min-w-0 max-w-24 rounded-lg border border-navy-100 bg-white px-1 text-[11px] sm:hidden">
          <option value="">Gốc</option>
          {moveTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
        </select>
        <TreeButton label="Lên" disabled={pending || index === 0} onClick={() => onMove(index - 1)}><ArrowUp /></TreeButton>
        <TreeButton label="Xuống" disabled={pending || index === siblingCount - 1} onClick={() => onMove(index + 1)}><ArrowDown /></TreeButton>
        <TreeButton label="Đổi tên" disabled={pending} onClick={onRename}><Pencil /></TreeButton>
        <TreeButton label={folder.count ? "Chỉ xóa được thư mục rỗng" : "Xóa"} disabled={pending || folder.count > 0} onClick={onDelete} danger><Trash2 /></TreeButton>
      </div>
      {expanded && children}
    </div>
  );
}

function ResourceRow({ resource, index, siblingCount, pending, onMove, moveTargets, onMoveTo }: { resource: TreeResource; index: number; siblingCount: number; pending: boolean; onMove: (position: number) => void; moveTargets: { id: string; label: string }[]; onMoveTo: (folderId: string | null) => void }) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id: `drag:resource:${resource.id}`, data: { type: "resource", id: resource.id } satisfies DragData, disabled: pending });
  const { setNodeRef: setSlotRef, isOver: isOverSlot } = useDroppable({ id: `slot:resource:${resource.id}`, data: { type: "resource-slot", folderId: resource.folderId, position: index } satisfies DropData, disabled: pending });
  return (
    <div
      ref={setSlotRef}
      className={isOverSlot ? "rounded-xl ring-2 ring-navy-300" : ""}
    >
      <div ref={setDragRef} style={{ transform: CSS.Translate.toString(transform) }} className={`flex min-w-0 flex-wrap items-center gap-1 rounded-xl px-2 py-2 text-sm text-navy-500 ${isDragging ? "z-10 bg-white opacity-70 shadow-lg" : "hover:bg-pastel-50"}`}>
        <span className="w-1 sm:w-7" />
        <button type="button" className="flex size-11 touch-none cursor-grab items-center justify-center rounded hover:bg-white active:cursor-grabbing sm:size-7" aria-label="Kéo mục" {...listeners} {...attributes}>
          <GripVertical className="size-4" />
        </button>
        <FileText className="size-4 shrink-0 text-navy-300" />
        <span className="min-w-0 flex-1 truncate">{resource.title}</span>
        {resource.meta && <span className="hidden max-w-48 truncate text-[11px] text-navy-300 md:block">{resource.meta}</span>}
        <select aria-label={`Di chuyển ${resource.title}`} title="Di chuyển đến…" value={resource.folderId ?? ""} disabled={pending} onChange={(event) => onMoveTo(event.target.value || null)} className="min-h-11 w-24 min-w-0 max-w-24 rounded-lg border border-navy-100 bg-white px-1 text-[11px] sm:hidden">
          <option value="">Gốc</option>
          {moveTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
        </select>
        <TreeButton label="Lên" disabled={pending || index === 0} onClick={() => onMove(index - 1)}><ArrowUp /></TreeButton>
        <TreeButton label="Xuống" disabled={pending || index === siblingCount - 1} onClick={() => onMove(index + 1)}><ArrowDown /></TreeButton>
      </div>
    </div>
  );
}

function TreeButton({ label, disabled, onClick, danger = false, children }: { label: string; disabled: boolean; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={`flex size-11 items-center justify-center rounded p-1 disabled:opacity-25 sm:size-7 ${danger ? "text-red-500 hover:bg-red-50" : "hover:bg-white"}`}>
      <span className="[&>svg]:size-3.5">{children}</span>
    </button>
  );
}
