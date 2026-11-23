"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button, Dialog, Field, Input, Text, VisuallyHidden } from "@/components/ui";
import type { FieldDef } from "@/data/types";
import type { FilterRule } from "@/features/report/viewState";
import { useI18n, type I18nKey } from "@/i18n";
import { ColumnSection, controlId, hintId, type ColumnActions, type ControlName, type DropTarget } from "./ColumnSection";
import {
  COLUMN_LISTS,
  anchorKeys,
  defaultDraft,
  listOf,
  matchesColumn,
  moveBy,
  moveSet,
  place,
  sameDraft,
  toDraft,
  type ColumnDraft,
  type ColumnList,
  type ColumnsResult,
} from "./columns";
import { Drawer, DrawerBody, DrawerFooter } from "./Drawer";
import { setColumnsPreview } from "./uiStore";

const DRAG_FORMAT = "text/plain";
const MOVED_ONE: Record<ColumnList, I18nKey> = { visible: "gridx.columns.shown", hidden: "gridx.columns.hiddenNow" };
const MOVED_MANY: Record<ColumnList, I18nKey> = { visible: "gridx.columns.bulkShown", hidden: "gridx.columns.bulkHidden" };

interface Choice {
  label: string;
  primary?: boolean;
  run: () => void;
}
type Confirm = "reset" | "unsaved" | "filtered";

interface ColumnsPanelProps {
  open: boolean;
  reportId: string;
  fields: readonly FieldDef[];
  /** `view.columns` when the panel opens. */
  columns: readonly string[];
  filters: readonly FilterRule[];
  onApply: (result: ColumnsResult) => void;
  /** Close without applying. */
  onClose: () => void;
}

interface MoveInput {
  key: string;
  target: ColumnList;
  before?: string;
  focus?: ControlName;
}

/** "Manage columns": show, hide and reorder columns in a draft, previewed live in the grid, applied on Done. */
export function ColumnsPanel({ open, reportId, fields, columns, filters, onApply, onClose }: ColumnsPanelProps) {
  const { t } = useI18n();
  const idBase = useId();
  const anchors = useMemo(() => anchorKeys(fields), [fields]);
  const byKey = useMemo(() => new Map(fields.map((field) => [field.key, field])), [fields]);
  const [initial] = useState(() => toDraft(fields, columns));
  const [draft, setDraft] = useState(initial);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [term, setTerm] = useState("");
  const [expanded, setExpanded] = useState<Record<ColumnList, boolean>>({ visible: true, hidden: false });
  const [status, setStatus] = useState("");
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  // A row that changes list is remounted and loses focus; this names the control to focus again afterwards.
  const refocus = useRef<string | null>(null);

  useEffect(() => {
    if (!refocus.current) return;
    document.getElementById(refocus.current)?.focus();
    refocus.current = null;
  }, [draft]);

  const nameOf = (key: string) => {
    const field = byKey.get(key);
    return field ? t(field.labelKey) : key;
  };
  const defaults = defaultDraft(fields);
  const dirty = !sameDraft(draft, initial);
  const filteredKeys = new Set(filters.filter((rule) => rule.enabled !== false).map((rule) => rule.field));
  const hiddenFiltered = draft.hidden.filter((key) => initial.visible.includes(key) && filteredKeys.has(key));

  const commit = ({ next, highlight, message }: { next: ColumnDraft; highlight: string | null; message: string }) => {
    setDraft(next);
    setStatus(message);
    setColumnsPreview({ reportId, columns: next.visible, highlight });
  };
  const movedMessage = (next: ColumnDraft, key: string) => {
    const keys = next[listOf(next, key)];
    return t("gridx.columns.moved", { name: nameOf(key), position: keys.indexOf(key) + 1, total: keys.length });
  };
  const moveTo = ({ key, target, before, focus }: MoveInput) => {
    const keys = moveSet(draft, key, selected);
    const next = place({ draft, keys, target, before, anchors });
    if (next === draft) return;
    if (listOf(draft, key) === target) return commit({ next, highlight: key, message: movedMessage(next, key) });
    setExpanded((current) => ({ ...current, [target]: true }));
    setSelected(new Set());
    if (focus) refocus.current = controlId({ base: idBase, control: focus, key });
    const message = keys.length > 1 ? t(MOVED_MANY[target], { count: keys.length }) : t(MOVED_ONE[target], { name: nameOf(key) });
    commit({ next, highlight: key, message });
  };

  const actions: ColumnActions = {
    toggleSection: (list) => setExpanded((current) => ({ ...current, [list]: !current[list] })),
    select: (keys, on) =>
      setSelected((current) => {
        const next = new Set(current);
        keys.forEach((key) => (on ? next.add(key) : next.delete(key)));
        return next;
      }),
    step: (key, delta) => {
      const next = moveBy({ draft, key, delta, anchors });
      if (next !== draft) commit({ next, highlight: key, message: movedMessage(next, key) });
    },
    move: moveTo,
    dragStart: (event, key) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(DRAG_FORMAT, key);
      setDragKey(key);
    },
    dragOver: (event, { list, key }) => {
      if (!dragKey) return;
      event.preventDefault();
      event.stopPropagation();
      // Past the middle of a row the drop lands after it, which is "before the next one".
      const box = event.currentTarget.getBoundingClientRect();
      const after = key !== undefined && event.clientY > box.top + box.height / 2;
      const before = after ? draft[list][draft[list].indexOf(key) + 1] : key;
      if (drop?.list === list && drop.before === before) return;
      setDrop({ list, before });
      const preview = place({ draft, keys: moveSet(draft, dragKey, selected), target: list, before, anchors });
      setColumnsPreview({ reportId, columns: preview.visible, highlight: dragKey });
    },
    drop: (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (dragKey && drop) moveTo({ key: dragKey, target: drop.list, before: drop.before });
    },
    dragEnd: () => {
      setDragKey(null);
      setDrop(null);
      setColumnsPreview({ reportId, columns: draft.visible, highlight: null });
    },
  };

  // "Hide only the columns with no filter": each filtered column goes back before its old right-hand neighbour.
  const withFilteredVisible = () =>
    hiddenFiltered.reduce((next, key) => {
      const before = initial.visible.slice(initial.visible.indexOf(key) + 1).find((later) => next.visible.includes(later));
      return place({ draft: next, keys: [key], target: "visible", before, anchors });
    }, draft).visible;
  const done = () => (hiddenFiltered.length > 0 ? setConfirm("filtered") : onApply({ columns: draft.visible }));
  const dismiss = () => setConfirm(null);

  const confirms: Record<Confirm, { title: string; body: string; choices: Choice[] }> = {
    reset: {
      title: t("gridx.columns.reset"),
      body: t("gridx.columns.resetBody"),
      choices: [
        {
          label: t("gridx.columns.resetStay"),
          run: () => {
            commit({ next: defaults, highlight: null, message: t("gridx.columns.saved") });
            dismiss();
          },
        },
        { label: t("gridx.columns.resetClose"), primary: true, run: () => onApply({ columns: defaults.visible }) },
      ],
    },
    unsaved: {
      title: t("gridx.columns.unsavedTitle"),
      body: t("gridx.columns.unsavedBody"),
      choices: [
        { label: t("gridx.columns.keepEditing"), run: dismiss },
        { label: t("gridx.columns.discard"), run: onClose },
        { label: t("action.save"), primary: true, run: done },
      ],
    },
    filtered: {
      title: t("gridx.columns.filteredTitle"),
      body: t("gridx.columns.filteredBody", { columns: hiddenFiltered.map(nameOf).join(", ") }),
      choices: [
        { label: t("gridx.columns.filtered.remove"), run: () => onApply({ columns: draft.visible, filters: { action: "remove", fields: hiddenFiltered } }) },
        { label: t("gridx.columns.filtered.clear"), run: () => onApply({ columns: draft.visible, filters: { action: "clear", fields: hiddenFiltered } }) },
        { label: t("gridx.columns.filtered.keep"), run: () => onApply({ columns: draft.visible }) },
        { label: t("gridx.columns.filtered.skip"), primary: true, run: () => onApply({ columns: withFilteredVisible() }) },
      ],
    },
  };
  const asked = confirm ? confirms[confirm] : null;

  return (
    <>
      <Drawer open={open} onClose={() => (dirty ? setConfirm("unsaved") : onClose())} title={t("gridx.columns.open")}>
        <DrawerBody>
          <Text $muted $size="sm">
            {t("gridx.columns.description")}
          </Text>
          <VisuallyHidden id={hintId(idBase)}>{t("gridx.columns.handleHint")}</VisuallyHidden>
          <Field label={t("gridx.columns.search")}>
            {(id) => <Input id={id} type="search" value={term} onChange={(event) => setTerm(event.target.value)} />}
          </Field>
          <VisuallyHidden role="status">{status}</VisuallyHidden>
          {COLUMN_LISTS.map((list) => (
            <ColumnSection
              key={list}
              list={list}
              all={draft[list]}
              shown={draft[list].filter((key) => {
                const field = byKey.get(key);
                return field !== undefined && matchesColumn({ field, label: t(field.labelKey), term });
              })}
              fields={byKey}
              anchors={anchors}
              selected={selected}
              expanded={expanded[list] || term.trim() !== ""}
              searching={term.trim() !== ""}
              dragKey={dragKey}
              drop={drop}
              idBase={idBase}
              actions={actions}
            />
          ))}
        </DrawerBody>
        <DrawerFooter>
          <Button disabled={!dirty} onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button disabled={sameDraft(draft, defaults)} onClick={() => setConfirm("reset")}>
            {t("gridx.columns.reset")}
          </Button>
          <Button $variant="primary" onClick={done}>
            {t("action.done")}
          </Button>
        </DrawerFooter>
      </Drawer>
      <Dialog
        open={open && asked !== null}
        onClose={dismiss}
        title={asked?.title ?? ""}
        footer={asked?.choices.map((choice) => (
          <Button key={choice.label} $variant={choice.primary ? "primary" : "outline"} onClick={choice.run}>
            {choice.label}
          </Button>
        ))}
      >
        <Text>{asked?.body}</Text>
      </Dialog>
    </>
  );
}
