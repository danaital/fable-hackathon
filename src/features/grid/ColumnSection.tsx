"use client";

import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, Lock, type LucideIcon } from "lucide-react";
import type { DragEvent } from "react";
import { Button, Heading, VisuallyHidden } from "@/components/ui";
import type { FieldDef } from "@/data/types";
import { useI18n, type I18nKey } from "@/i18n";
import { OTHER_LIST, type ColumnList as ListName } from "./columns";
import { ColumnItem, ColumnList, ColumnName, DropZone, HitArea, IconSlot, SectionBox, SectionHead, Switch, TriCheck } from "./panelParts";

const ICON_SIZE = 16;
const LIST_ICON: Record<ListName, LucideIcon> = { visible: Eye, hidden: EyeOff };
const LIST_TITLE: Record<ListName, I18nKey> = { visible: "gridx.columns.visible", hidden: "gridx.columns.hidden" };
const BULK_LABEL: Record<ListName, I18nKey> = { visible: "gridx.columns.bulkHide", hidden: "gridx.columns.bulkShow" };
const STEP_KEYS: Record<string, 1 | -1 | undefined> = { ArrowUp: -1, ArrowDown: 1 };
// Left and Right both mean "the other list": the lists are stacked, so neither arrow points at one. Not mirrored in RTL.
const CROSS_KEYS: ReadonlySet<string> = new Set(["ArrowLeft", "ArrowRight"]);

export interface DropTarget {
  list: ListName;
  /** Insert before this column; undefined means the end of the list. */
  before?: string;
}

export interface ColumnActions {
  toggleSection: (list: ListName) => void;
  select: (keys: readonly string[], on: boolean) => void;
  step: (key: string, delta: 1 | -1) => void;
  /** Moves the column (and the rest of the selection, when it is selected) to a list. `focus` names the control to refocus. */
  move: (input: { key: string; target: ListName; focus: ControlName }) => void;
  dragStart: (event: DragEvent, key: string) => void;
  /** `key` is the row under the pointer; without it the pointer is over the section itself. */
  dragOver: (event: DragEvent, over: { list: ListName; key?: string }) => void;
  drop: (event: DragEvent) => void;
  dragEnd: () => void;
}

export const CONTROLS = ["handle", "switch"] as const;
export type ControlName = (typeof CONTROLS)[number];
export const controlId = ({ base, control, key }: { base: string; control: ControlName; key: string }) => `${base}-${control}-${key}`;
export const hintId = (base: string) => `${base}-hint`;

interface ColumnSectionProps {
  list: ListName;
  /** Every key of this list, in order. */
  all: readonly string[];
  /** The keys that match the search; only these rows show. */
  shown: readonly string[];
  fields: ReadonlyMap<string, FieldDef>;
  anchors: readonly string[];
  selected: ReadonlySet<string>;
  expanded: boolean;
  searching: boolean;
  dragKey: string | null;
  drop: DropTarget | null;
  idBase: string;
  actions: ColumnActions;
}

/** One of the two lists of the columns panel (Visible or Hidden), with its rows. */
export function ColumnSection(props: ColumnSectionProps) {
  const { list, all, shown, fields, anchors, selected, expanded, searching, dragKey, drop, idBase, actions } = props;
  const { t } = useI18n();
  const title = t(LIST_TITLE[list]);
  const Icon = LIST_ICON[list];
  const Chevron = expanded ? ChevronUp : ChevronDown;
  const listId = `${idBase}-list-${list}`;
  const selectable = shown.filter((key) => !anchors.includes(key));
  const picked = selectable.filter((key) => selected.has(key));
  const firstMovable = list === "visible" ? anchors.length : 0;
  const dropHere = drop?.list === list;

  return (
    <SectionBox $dropEnd={dropHere && drop.before === undefined} onDragOver={(event) => actions.dragOver(event, { list })} onDrop={actions.drop}>
      <SectionHead>
        <TriCheck
          label={t("gridx.columns.selectAll", { title })}
          checked={selectable.length > 0 && picked.length === selectable.length}
          indeterminate={picked.length > 0 && picked.length < selectable.length}
          disabled={selectable.length === 0}
          onChange={(on) => actions.select(selectable, on)}
        />
        <Heading as="h3" $size="sm">
          <Button $variant="ghost" aria-expanded={expanded} aria-controls={listId} onClick={() => actions.toggleSection(list)}>
            <Icon size={ICON_SIZE} aria-hidden />
            {t("gridx.columns.section", { title, count: shown.length })}
            <Chevron size={ICON_SIZE} aria-hidden />
          </Button>
        </Heading>
        {picked.length > 0 ? (
          <Button onClick={() => actions.move({ key: picked[0], target: OTHER_LIST[list], focus: "switch" })}>{t(BULK_LABEL[list], { count: picked.length })}</Button>
        ) : null}
      </SectionHead>
      {expanded && shown.length === 0 ? <DropZone>{t(searching ? "gridx.columns.noMatch" : "gridx.columns.dropHere")}</DropZone> : null}
      {expanded && shown.length > 0 ? (
        <ColumnList id={listId}>
          {shown.map((key) => {
            const field = fields.get(key);
            if (!field) return null;
            const name = t(field.labelKey);
            const anchor = anchors.includes(key);
            const index = all.indexOf(key);
            return (
              <ColumnItem
                key={key}
                draggable={!anchor}
                $dragging={dragKey === key}
                $dropBefore={dropHere && drop.before === key}
                onDragStart={(event) => actions.dragStart(event, key)}
                onDragOver={(event) => actions.dragOver(event, { list, key })}
                onDrop={actions.drop}
                onDragEnd={actions.dragEnd}
              >
                {anchor ? (
                  <IconSlot title={t("gridx.columns.anchor")}>
                    <Lock size={ICON_SIZE} aria-hidden />
                    <VisuallyHidden>{t("gridx.columns.anchor")}</VisuallyHidden>
                  </IconSlot>
                ) : (
                  <>
                    <TriCheck label={t("gridx.columns.select", { name })} checked={selected.has(key)} onChange={(on) => actions.select([key], on)} />
                    <Button
                      $variant="ghost"
                      $icon
                      id={controlId({ base: idBase, control: "handle", key })}
                      aria-label={t("gridx.columns.handle", { name })}
                      aria-describedby={hintId(idBase)}
                      onKeyDown={(event) => {
                        const delta = STEP_KEYS[event.key];
                        if (!delta && !CROSS_KEYS.has(event.key)) return;
                        event.preventDefault();
                        if (delta) actions.step(key, delta);
                        else actions.move({ key, target: OTHER_LIST[list], focus: "handle" });
                      }}
                    >
                      <GripVertical size={ICON_SIZE} aria-hidden />
                    </Button>
                  </>
                )}
                <ColumnName dir="auto">{name}</ColumnName>
                {anchor ? null : (
                  <>
                    <Button
                      $variant="ghost"
                      $icon
                      aria-label={t("gridx.columns.up", { name })}
                      disabled={index <= firstMovable}
                      onClick={() => actions.step(key, -1)}
                    >
                      <ArrowUp size={ICON_SIZE} aria-hidden />
                    </Button>
                    <Button
                      $variant="ghost"
                      $icon
                      aria-label={t("gridx.columns.down", { name })}
                      disabled={index >= all.length - 1}
                      onClick={() => actions.step(key, 1)}
                    >
                      <ArrowDown size={ICON_SIZE} aria-hidden />
                    </Button>
                  </>
                )}
                <HitArea title={anchor ? t("gridx.columns.anchorSwitch", { name }) : undefined}>
                  <Switch
                    id={controlId({ base: idBase, control: "switch", key })}
                    aria-label={t(anchor ? "gridx.columns.anchorSwitch" : "gridx.columns.show", { name })}
                    checked={list === "visible"}
                    disabled={anchor}
                    onChange={() => actions.move({ key, target: OTHER_LIST[list], focus: "switch" })}
                  />
                </HitArea>
              </ColumnItem>
            );
          })}
        </ColumnList>
      ) : null}
    </SectionBox>
  );
}
