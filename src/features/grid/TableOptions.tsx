"use client";

import { ArrowDownUp, Sigma } from "lucide-react";
import { useState } from "react";
import { Button, Dialog, Field, Grid, Notice, Select, Stack, Text } from "@/components/ui";
import type { FieldDef } from "@/data/types";
import { useI18n } from "@/i18n";
import { SortControl } from "./HeaderCell";
import { calcLabelKey } from "./TotalsRow";
import { ChipItem, ChipList } from "./panelParts";
import type { SortRule } from "./sort";
import { totalOptions, type TotalKind } from "./totals";

const ICON_SIZE = 16;
const NO_CALCULATION = "";
const CALC_COLUMN_MIN = "200px";

interface TableOptionsProps {
  /** Visible fields, in display order. */
  fields: readonly FieldDef[];
  sorts: readonly SortRule[];
  onSort: (key: string) => void;
  onClearSorts: () => void;
  kinds: Readonly<Record<string, TotalKind>>;
  onKind: (field: FieldDef, kind: TotalKind | null) => void;
  /** The user's settings hide the totals row; the dialog says so, because choices made here would not show. */
  totalsHidden: boolean;
}
type Open = "sort" | "totals" | null;

/**
 * The table's own options: sorting from a list (header cells can be scrolled out of view on a phone)
 * and the calculation of each column's total. Where the totals row sits is a user setting.
 */
export function TableOptions(props: TableOptionsProps) {
  const { fields, sorts, onSort, onClearSorts, kinds, onKind, totalsHidden } = props;
  const { t } = useI18n();
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  const done = (
    <Button $variant="primary" onClick={close}>
      {t("action.done")}
    </Button>
  );

  return (
    <Stack $row $wrap $gap="sm">
      <Button aria-haspopup="dialog" onClick={() => setOpen("sort")}>
        <ArrowDownUp size={ICON_SIZE} aria-hidden />
        {t("gridx.sort.menu")}
      </Button>
      <Button aria-haspopup="dialog" onClick={() => setOpen("totals")}>
        <Sigma size={ICON_SIZE} aria-hidden />
        {t("gridx.totals.open")}
      </Button>

      <Dialog
        open={open === "sort"}
        onClose={close}
        title={t("gridx.sort.menuTitle")}
        footer={
          <>
            <Button disabled={sorts.length === 0} onClick={onClearSorts}>
              {t("gridx.sort.clear")}
            </Button>
            {done}
          </>
        }
      >
        <Text $muted $size="sm">
          {t("gridx.sort.hint")}
        </Text>
        <ChipList>
          {fields.map((field) => (
            <ChipItem key={field.key}>
              <SortControl field={field} sorts={sorts} onSort={onSort} />
            </ChipItem>
          ))}
        </ChipList>
      </Dialog>

      <Dialog open={open === "totals"} onClose={close} title={t("gridx.totals.title")} footer={done}>
        <Text $muted $size="sm">
          {t("gridx.totals.hint")}
        </Text>
        {totalsHidden ? <Notice $tone="warning">{t("gridx.totals.hidden")}</Notice> : null}
        <Grid $min={CALC_COLUMN_MIN}>
          {fields.map((field) => (
            <Field key={field.key} label={t(field.labelKey)}>
              {(id) => (
                <Select
                  id={id}
                  value={kinds[field.key] ?? NO_CALCULATION}
                  onChange={(event) => onKind(field, totalOptions(field.type).find((kind) => kind === event.target.value) ?? null)}
                >
                  <option value={NO_CALCULATION}>{t("gridx.totals.none")}</option>
                  {totalOptions(field.type).map((kind) => (
                    <option key={kind} value={kind}>
                      {t(calcLabelKey(kind, field.type))}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ))}
        </Grid>
      </Dialog>
    </Stack>
  );
}
