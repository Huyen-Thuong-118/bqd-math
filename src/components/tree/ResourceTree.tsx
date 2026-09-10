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
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  FileText,
  Folder,
  FolderInput,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

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
  mode?: "tree" | "grid";
  storageKey?: string;
  pending?: boolean;
  onMoveFolder: (id: string, parentId: string | null, position?: number) => void;
  onMoveResource: (id: string, folderId: string | null, position?: number) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onCreateFolder?: (name: string, parentId: string | null) => void;
  onCopyFolder?: (id: string, parentId: string | null) => void;
  onCopyResource?: (id: string, folderId: string | null) => void;
};

type DragData = { type: "folder" | "resource"; id: string };
type ClipboardData = DragData & { operation: "copy" | "cut"; label: string };
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
  mode = "tree",
  storageKey = `resource-tree:${resourceName}`,
  pending = false,
  onMoveFolder,
  onMoveResource,
  onRenameFolder,
  onDeleteFolder,
  onCreateFolder,
  onCopyFolder,
  onCopyResource,
}: Props) {
  const dndContextId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [expanded, setExpanded] = useState(() => new Set(folders.map((folder) => folder.id)));
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selected, setSelected] = useState<DragData | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const restoredExpansion = useRef(false);
  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
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
    return folders.map((folder) => {
      const names = [folder.name];
      let parentId = folder.parentId;
      const seen = new Set<string>();
      while (parentId && !seen.has(parentId)) {
        seen.add(parentId);
        const parent = folderById.get(parentId);
        if (!parent) break;
        names.unshift(parent.name);
        parentId = parent.parentId;
      }
      return { id: folder.id, label: names.join(" / "), parentId: folder.parentId };
    }).sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [folderById, folders]);
  const currentPath = useMemo(() => {
    const path: TreeFolder[] = [];
    const seen = new Set<string>();
    let cursor = currentFolderId;
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const folder = folderById.get(cursor);
      if (!folder) break;
      path.unshift(folder);
      cursor = folder.parentId;
    }
    return path;
  }, [currentFolderId, folderById]);
  const resourceById = useMemo(() => new Map(resources.map((resource) => [resource.id, resource])), [resources]);

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

  useEffect(() => {
    if (currentFolderId && !folderById.has(currentFolderId)) {
      const frame = window.requestAnimationFrame(() => setCurrentFolderId(null));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [currentFolderId, folderById]);

  function toggle(folderId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function folderCanMoveInto(folderId: string, targetFolderId: string) {
    let cursor: string | null = targetFolderId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      if (cursor === folderId) return false;
      seen.add(cursor);
      cursor = folderById.get(cursor)?.parentId ?? null;
    }
    return true;
  }

  function moveTargetsFor(folderId: string) {
    return folderChoices.filter((candidate) => folderCanMoveInto(folderId, candidate.id));
  }

  const putOnClipboard = useCallback((item: DragData, operation: "copy" | "cut") => {
    const label = item.type === "folder" ? folderById.get(item.id)?.name : resourceById.get(item.id)?.title;
    if (!label) return;
    setSelected(item);
    setClipboard({ ...item, operation, label });
  }, [folderById, resourceById]);

  const pasteClipboard = useCallback(() => {
    if (!clipboard || pending) return;
    if (clipboard.operation === "cut") {
      if (clipboard.type === "folder") {
        onMoveFolder(clipboard.id, currentFolderId);
      } else onMoveResource(clipboard.id, currentFolderId);
      setClipboard(null);
      return;
    }
    if (clipboard.type === "folder") onCopyFolder?.(clipboard.id, currentFolderId);
    else onCopyResource?.(clipboard.id, currentFolderId);
  }, [clipboard, currentFolderId, onCopyFolder, onCopyResource, onMoveFolder, onMoveResource, pending]);

  useEffect(() => {
    if (mode !== "grid") return;
    function handleShortcut(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if ((key === "c" || key === "x") && selected) {
        event.preventDefault();
        putOnClipboard(selected, key === "c" ? "copy" : "cut");
      }
      if (key === "v" && clipboard) {
        event.preventDefault();
        pasteClipboard();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [clipboard, mode, pasteClipboard, putOnClipboard, selected]);

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
      if (drag.type === "folder") {
        if (!folderCanMoveInto(drag.id, drop.folderId)) return;
        onMoveFolder(drag.id, drop.folderId);
      }
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
            moveTargets={moveTargetsFor(folder.id)}
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
      {mode === "tree" ? <>
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
      </> : <GridDirectory
        currentFolderId={currentFolderId}
        currentPath={currentPath}
        folders={childrenByParent.get(currentFolderId) ?? []}
        resources={resourcesByFolder.get(currentFolderId) ?? []}
        resourceName={resourceName}
        pending={pending}
        onOpenFolder={(folderId) => { setCurrentFolderId(folderId); setSelected(null); }}
        onMoveFolder={onMoveFolder}
        onMoveResource={onMoveResource}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
        folderChoices={folderChoices}
        moveTargetsFor={moveTargetsFor}
        selected={selected}
        clipboard={clipboard}
        canPaste={Boolean(clipboard && (clipboard.operation === "cut" || (clipboard.type === "folder" ? onCopyFolder : onCopyResource)))}
        creatingFolder={creatingFolder}
        newFolderName={newFolderName}
        canCreateFolder={Boolean(onCreateFolder)}
        onSelect={setSelected}
        onCopy={(item) => putOnClipboard(item, "copy")}
        onCut={(item) => putOnClipboard(item, "cut")}
        onPaste={pasteClipboard}
        onShowCreateFolder={() => setCreatingFolder(true)}
        onHideCreateFolder={() => { setCreatingFolder(false); setNewFolderName(""); }}
        onNewFolderNameChange={setNewFolderName}
        onCreateFolder={() => {
          const name = newFolderName.trim();
          if (!name || !onCreateFolder) return;
          onCreateFolder(name, currentFolderId);
          setCreatingFolder(false);
          setNewFolderName("");
        }}
      />}
    </DndContext>
  );
}

function GridDirectory({
  currentFolderId,
  currentPath,
  folders,
  resources,
  resourceName,
  pending,
  onOpenFolder,
  onMoveFolder,
  onMoveResource,
  onRenameFolder,
  onDeleteFolder,
  folderChoices,
  moveTargetsFor,
  selected,
  clipboard,
  canPaste,
  creatingFolder,
  newFolderName,
  canCreateFolder,
  onSelect,
  onCopy,
  onCut,
  onPaste,
  onShowCreateFolder,
  onHideCreateFolder,
  onNewFolderNameChange,
  onCreateFolder,
}: {
  currentFolderId: string | null;
  currentPath: TreeFolder[];
  folders: TreeFolder[];
  resources: TreeResource[];
  resourceName: string;
  pending: boolean;
  onOpenFolder: (folderId: string | null) => void;
  onMoveFolder: (id: string, parentId: string | null, position?: number) => void;
  onMoveResource: (id: string, folderId: string | null, position?: number) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  folderChoices: { id: string; label: string }[];
  moveTargetsFor: (folderId: string) => { id: string; label: string }[];
  selected: DragData | null;
  clipboard: ClipboardData | null;
  canPaste: boolean;
  creatingFolder: boolean;
  newFolderName: string;
  canCreateFolder: boolean;
  onSelect: (item: DragData | null) => void;
  onCopy: (item: DragData) => void;
  onCut: (item: DragData) => void;
  onPaste: () => void;
  onShowCreateFolder: () => void;
  onHideCreateFolder: () => void;
  onNewFolderNameChange: (value: string) => void;
  onCreateFolder: () => void;
}) {
  const currentFolder = currentPath.at(-1);
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2 border-b border-navy-50 pb-3">
      <button type="button" disabled={!canCreateFolder || pending} onClick={onShowCreateFolder} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-navy-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-40"><Plus className="size-4" />Mới</button>
      <button type="button" disabled={!canPaste || pending} onClick={onPaste} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-navy-100 bg-white px-4 py-2 text-xs font-semibold text-navy-500 disabled:opacity-35"><ClipboardPaste className="size-4" />Dán</button>
      {clipboard && <span className="min-w-0 truncate text-xs text-navy-300">{clipboard.operation === "copy" ? "Đã sao chép" : "Đã cắt"}: {clipboard.label}</span>}
    </div>
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto pb-1 text-xs font-semibold text-navy-400" aria-label="Đường dẫn thư mục">
      {currentFolder && <button type="button" onClick={() => onOpenFolder(currentFolder.parentId)} className="flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-pastel-50" aria-label="Quay lại thư mục cha"><ChevronLeft className="size-4" /></button>}
      <button type="button" onClick={() => onOpenFolder(null)} className={`shrink-0 rounded-lg px-2 py-1.5 hover:bg-pastel-50 ${!currentFolderId ? "bg-pastel-100 text-navy-600" : ""}`}>Thư mục gốc</button>
      {currentPath.map((folder) => <span key={folder.id} className="flex shrink-0 items-center gap-1"><ChevronRight className="size-3.5 text-navy-200" /><button type="button" onClick={() => onOpenFolder(folder.id)} className={`rounded-lg px-2 py-1.5 hover:bg-pastel-50 ${folder.id === currentFolderId ? "bg-pastel-100 text-navy-600" : ""}`}>{folder.name}</button></span>)}
    </div>
    <DirectoryDropZone folderId={currentFolderId} folderName={currentFolder?.name ?? "thư mục gốc"} disabled={pending} />
    {!!folders.length && <h3 className="pt-1 text-sm font-semibold text-navy-500">Thư mục</h3>}
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(9rem,100%),1fr))] gap-3">
      {folders.map((folder) => <GridFolderCard
        key={folder.id}
        folder={folder}
        pending={pending}
        moveTargets={moveTargetsFor(folder.id)}
        onOpen={() => onOpenFolder(folder.id)}
        onMoveTo={(parentId) => onMoveFolder(folder.id, parentId)}
        onRename={() => {
          const name = window.prompt("Tên mới của thư mục", folder.name)?.trim();
          if (name && name !== folder.name) onRenameFolder(folder.id, name);
        }}
        onDelete={() => {
          if (window.confirm(`Xóa thư mục “${folder.name}”?`)) onDeleteFolder(folder.id);
        }}
        selected={selected?.type === "folder" && selected.id === folder.id}
        onSelect={() => onSelect({ type: "folder", id: folder.id })}
        onCopy={() => onCopy({ type: "folder", id: folder.id })}
        onCut={() => onCut({ type: "folder", id: folder.id })}
      />)}
    </div>
    {!!resources.length && <h3 className="pt-3 text-sm font-semibold text-navy-500">Tệp</h3>}
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(9rem,100%),1fr))] gap-3">
      {resources.map((resource) => <GridResourceCard key={resource.id} resource={resource} pending={pending} moveTargets={folderChoices} onMoveTo={(folderId) => onMoveResource(resource.id, folderId)} selected={selected?.type === "resource" && selected.id === resource.id} onSelect={() => onSelect({ type: "resource", id: resource.id })} onCopy={() => onCopy({ type: "resource", id: resource.id })} onCut={() => onCut({ type: "resource", id: resource.id })} />)}
    </div>
    {!folders.length && !resources.length && <p className="rounded-2xl border border-dashed border-navy-100 px-4 py-8 text-center text-sm text-navy-300">Thư mục này chưa có thư mục con hoặc {resourceName}.</p>}
    <p className="text-xs text-navy-300">Nhấp để chọn, nhấp đúp để mở thư mục. Dùng Ctrl/Cmd+C, X, V hoặc kéo thả để sắp xếp.</p>
    {creatingFolder && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onHideCreateFolder(); }} className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/30 p-4 backdrop-blur-[2px]">
      <form onSubmit={(event) => { event.preventDefault(); onCreateFolder(); }} role="dialog" aria-modal="true" aria-labelledby="new-folder-title" className="w-full max-w-md rounded-3xl border border-navy-100 bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3"><h3 id="new-folder-title" className="text-lg font-semibold text-navy-600">Thư mục mới</h3><button type="button" onClick={onHideCreateFolder} className="flex size-9 items-center justify-center rounded-full text-navy-300 hover:bg-pastel-50"><X className="size-4" /><span className="sr-only">Đóng</span></button></div>
        <p className="mt-1 text-xs text-navy-300">Tạo trong {currentFolder?.name ?? "Thư mục gốc"}</p>
        <input autoFocus value={newFolderName} onChange={(event) => onNewFolderNameChange(event.target.value)} maxLength={100} placeholder="Tên thư mục" className="mt-4 w-full rounded-xl border border-navy-200 px-3 py-3 text-sm text-navy-600 outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-100" />
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onHideCreateFolder} className="rounded-full px-4 py-2 text-sm font-semibold text-navy-400 hover:bg-pastel-50">Hủy</button><button type="submit" disabled={!newFolderName.trim() || pending} className="rounded-full bg-navy-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">Tạo</button></div>
      </form>
    </div>}
  </div>;
}

function DirectoryDropZone({ folderId, folderName, disabled }: { folderId: string | null; folderName: string; disabled: boolean }) {
  const data: DropData = folderId ? { type: "inside-folder", folderId } : { type: "root" };
  const { isOver, setNodeRef } = useDroppable({ id: `grid:directory:${folderId ?? "root"}`, data, disabled });
  return <div ref={setNodeRef} className={`flex min-w-0 items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-xs transition ${isOver ? "border-navy-500 bg-pastel-100 text-navy-600" : "border-navy-100 text-navy-300"}`}><FolderInput className="size-4 shrink-0" /><span className="min-w-0 break-words">Thả vào đây để chuyển đến {folderName}</span></div>;
}

function GridFolderCard({ folder, pending, moveTargets, selected, onOpen, onSelect, onMoveTo, onRename, onDelete, onCopy, onCut }: { folder: TreeFolder; pending: boolean; moveTargets: { id: string; label: string }[]; selected: boolean; onOpen: () => void; onSelect: () => void; onMoveTo: (parentId: string | null) => void; onRename: () => void; onDelete: () => void; onCopy: () => void; onCut: () => void }) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id: `grid:drag:folder:${folder.id}`, data: { type: "folder", id: folder.id } satisfies DragData, disabled: pending });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `grid:inside:folder:${folder.id}`, data: { type: "inside-folder", folderId: folder.id } satisfies DropData, disabled: pending });
  function setNodeRef(node: HTMLDivElement | null) { setDragRef(node); setDropRef(node); }
  return <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} onClick={onSelect} {...listeners} {...attributes} className={`group/card relative min-w-0 touch-none rounded-2xl border bg-white p-3 transition ${selected ? "border-navy-500 bg-pastel-50 ring-2 ring-navy-100" : "border-navy-100 hover:border-navy-200 hover:shadow-md"} ${isOver ? "border-navy-500 bg-pastel-100 ring-2 ring-navy-200" : ""} ${isDragging ? "z-10 cursor-grabbing opacity-60 shadow-lg" : "cursor-default"}`}>
    <div className="flex items-start justify-between gap-1">
      <button type="button" onClick={(event) => { event.stopPropagation(); onSelect(); }} onDoubleClick={(event) => { event.stopPropagation(); onOpen(); }} className="min-w-0 flex-1 text-left" title={`Nhấp đúp để mở ${folder.name}`}>
        <Folder className="size-10 fill-sky-200 text-sky-500" aria-hidden="true" />
        <span className="mt-2 line-clamp-2 break-words text-xs font-semibold leading-snug text-navy-600">{folder.name}</span>
        <span className="mt-1 block text-[10px] text-navy-300">{folder.count} mục</span>
      </button>
      <div className="flex shrink-0 items-center">
        <details className="relative" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <summary className="flex size-8 cursor-pointer list-none items-center justify-center rounded-lg text-navy-300 marker:hidden hover:bg-pastel-50 hover:text-navy-600"><MoreHorizontal className="size-4" /><span className="sr-only">Tùy chọn</span></summary>
          <div className="absolute right-0 z-20 mt-1 w-56 space-y-2 rounded-xl border border-navy-100 bg-white p-3 shadow-xl">
            <div className="grid grid-cols-2 gap-1"><button type="button" onClick={onCopy} className="flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs text-navy-500 hover:bg-pastel-50"><Copy className="size-3.5" />Sao chép</button><button type="button" onClick={onCut} className="flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs text-navy-500 hover:bg-pastel-50"><Scissors className="size-3.5" />Cắt</button></div>
            <label className="block text-[10px] font-semibold text-navy-300">Di chuyển đến<select aria-label={`Di chuyển thư mục ${folder.name}`} value={folder.parentId ?? ""} disabled={pending} onChange={(event) => onMoveTo(event.target.value || null)} className="mt-1 min-h-9 w-full rounded-lg border border-navy-100 bg-white px-2 text-xs text-navy-500"><option value="">Thư mục gốc</option>{moveTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</select></label>
            <div className="flex gap-2"><button type="button" disabled={pending} onClick={onRename} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-pastel-50 px-2 py-2 text-xs text-navy-500"><Pencil className="size-3.5" />Đổi tên</button><button type="button" title={folder.count ? "Chỉ xóa được thư mục rỗng" : "Xóa"} disabled={pending || folder.count > 0} onClick={onDelete} className="flex size-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-25"><Trash2 className="size-3.5" /></button></div>
          </div>
        </details>
      </div>
    </div>
  </div>;
}

function GridResourceCard({ resource, pending, moveTargets, selected, onSelect, onMoveTo, onCopy, onCut }: { resource: TreeResource; pending: boolean; moveTargets: { id: string; label: string }[]; selected: boolean; onSelect: () => void; onMoveTo: (folderId: string | null) => void; onCopy: () => void; onCut: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `grid:drag:resource:${resource.id}`, data: { type: "resource", id: resource.id } satisfies DragData, disabled: pending });
  return <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} onClick={onSelect} {...listeners} {...attributes} className={`min-w-0 touch-none rounded-2xl border bg-white p-3 transition hover:shadow-sm ${selected ? "border-navy-500 bg-pastel-50 ring-2 ring-navy-100" : "border-navy-100 hover:border-navy-200"} ${isDragging ? "z-10 cursor-grabbing opacity-60 shadow-lg" : "cursor-default"}`}>
    <div className="flex items-start justify-between gap-1">
      <div className="min-w-0 flex-1" title={resource.title}>
        <FileText className="size-10 text-navy-300" aria-hidden="true" />
        <p className="mt-2 line-clamp-2 break-words text-xs font-semibold leading-snug text-navy-600">{resource.title}</p>
        {resource.meta && <p className="mt-1 line-clamp-2 break-all text-[10px] leading-snug text-navy-300" title={resource.meta}>{resource.meta}</p>}
      </div>
      <div className="flex shrink-0 items-center">
        <details className="relative" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}><summary className="flex size-8 cursor-pointer list-none items-center justify-center rounded-lg text-navy-300 marker:hidden hover:bg-pastel-50 hover:text-navy-600"><MoreHorizontal className="size-4" /><span className="sr-only">Tùy chọn</span></summary><div className="absolute right-0 z-20 mt-1 w-56 space-y-2 rounded-xl border border-navy-100 bg-white p-3 shadow-xl"><div className="grid grid-cols-2 gap-1"><button type="button" onClick={onCopy} className="flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs text-navy-500 hover:bg-pastel-50"><Copy className="size-3.5" />Sao chép</button><button type="button" onClick={onCut} className="flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs text-navy-500 hover:bg-pastel-50"><Scissors className="size-3.5" />Cắt</button></div><label className="block text-[10px] font-semibold text-navy-300">Di chuyển đến<select aria-label={`Di chuyển ${resource.title}`} value={resource.folderId ?? ""} disabled={pending} onChange={(event) => onMoveTo(event.target.value || null)} className="mt-1 min-h-9 w-full rounded-lg border border-navy-100 bg-white px-2 text-xs text-navy-500"><option value="">Thư mục gốc</option>{moveTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</select></label></div></details>
      </div>
    </div>
  </div>;
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
        <span className="min-w-40 flex-1 whitespace-normal break-words leading-snug" title={resource.title}>{resource.title}</span>
        {resource.meta && <span className="max-w-48 shrink break-all text-right text-[11px] leading-snug text-navy-300">{resource.meta}</span>}
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
