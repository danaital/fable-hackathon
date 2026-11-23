"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import styled, { css } from "styled-components";
import { Checkbox, Field, Grid, Input, Ltr, Notice, Select, Stack, Text } from "@/components/ui";
import { useI18n } from "@/i18n";
import { HEX_COLOR, MIN_CONTRAST, contrastRatio } from "../design";
import { DESIGN_SECTIONS, FONT_FAMILIES, FONT_SIZE_MAX, FONT_SIZE_MIN, type FileDesign, type SectionStyle } from "../schema";
import { Disclosure, DisclosureSummary, ICON_SIZE, Option, pickOption } from "../ui";

const CONTROL_MIN_WIDTH = "180px";
const RATIO_DECIMALS = 1;

const Swatch = styled(Input)`
  ${({ theme: { size } }) => css`
    flex: none;
    inline-size: ${size.touch};
    padding: 0;
  `}
`;

// The one place colours do not come from the theme: this cell shows the user's own styling choice.
// Every value was validated (hex colour, font from a fixed list) before it reaches the CSS.
const PreviewCell = styled.span<{ $look: SectionStyle }>`
  ${({ theme: { color, space }, $look }) => css`
    flex: 1 1 0;
    min-inline-size: 0;
    padding: ${space.xs} ${space.sm};
    border: 1px solid ${color.border};
    background: ${$look.background};
    color: ${$look.fontColor};
    font-family: "${$look.fontFamily}", sans-serif;
    font-size: ${Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, $look.fontSize))}pt;
    font-weight: ${$look.bold ? "bold" : "normal"};
    font-style: ${$look.italic ? "italic" : "normal"};
    text-decoration: ${$look.underline ? "underline" : "none"};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `}
`;

const PREVIEW_COLUMNS = ["a", "b", "c"] as const;

/** A small table drawn in the design's real colours and fonts: header, a data row, the summary row, a group row. */
export function DesignPreview({ design }: { design: FileDesign }) {
  const { t } = useI18n();
  return (
    <Stack $gap="xs" role="group" aria-label={t("export.design.preview")}>
      <Text $muted $size="sm">
        {t("export.design.preview")}
      </Text>
      {DESIGN_SECTIONS.map((section) => (
        <Stack key={section} $row $gap="xs">
          {PREVIEW_COLUMNS.map((column) => (
            <PreviewCell key={column} $look={design[section]}>
              {t(`export.design.sample.${section}`)}
            </PreviewCell>
          ))}
        </Stack>
      ))}
    </Stack>
  );
}

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

/** A colour as a picker and as typed hex text; the text is only applied once it is a complete colour. */
function ColorField({ label, value, onChange }: ColorFieldProps) {
  // Holds what is being typed while it is not a valid colour yet.
  const [typing, setTyping] = useState<string | null>(null);
  const onText = (text: string) => {
    const valid = HEX_COLOR.test(text);
    setTyping(valid ? null : text);
    if (valid) onChange(text.toUpperCase());
  };
  return (
    <Field label={label}>
      {(id) => (
        <Stack $row $gap="xs">
          <Swatch type="color" aria-label={label} value={value} onChange={(event) => onText(event.target.value)} />
          <Ltr>
            <Input id={id} value={typing ?? value} maxLength={7} aria-invalid={typing !== null} onChange={(event) => onText(event.target.value)} />
          </Ltr>
        </Stack>
      )}
    </Field>
  );
}

interface SectionProps {
  title: string;
  look: SectionStyle;
  open: boolean;
  onChange: (look: SectionStyle) => void;
}

function SectionEditor({ title, look, open, onChange }: SectionProps) {
  const { t } = useI18n();
  const patch = (next: Partial<SectionStyle>) => onChange({ ...look, ...next });
  const ratio = contrastRatio(look.fontColor, look.background);
  const sizeValid = Number.isInteger(look.fontSize) && look.fontSize >= FONT_SIZE_MIN && look.fontSize <= FONT_SIZE_MAX;

  return (
    <Disclosure open={open || undefined}>
      <DisclosureSummary>{title}</DisclosureSummary>
      <Stack $gap="md">
        <Grid $min={CONTROL_MIN_WIDTH}>
          <ColorField label={t("export.design.background")} value={look.background} onChange={(background) => patch({ background })} />
          <ColorField label={t("export.design.fontColor")} value={look.fontColor} onChange={(fontColor) => patch({ fontColor })} />
          <Field label={t("export.design.fontFamily")}>
            {(id) => (
              <Select id={id} value={look.fontFamily} onChange={(event) => patch({ fontFamily: pickOption(FONT_FAMILIES, event.target.value, look.fontFamily) })}>
                {FONT_FAMILIES.map((family) => (
                  <Option key={family} value={family}>
                    {family}
                  </Option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label={t("export.design.fontSize")}
            error={sizeValid ? undefined : t("export.invalid.fontSize", { min: FONT_SIZE_MIN, max: FONT_SIZE_MAX })}
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                value={Number.isFinite(look.fontSize) ? look.fontSize : ""}
                aria-invalid={!sizeValid}
                onChange={(event) => patch({ fontSize: event.target.value === "" ? Number.NaN : Number(event.target.value) })}
              />
            )}
          </Field>
        </Grid>
        <Stack $row $wrap $gap="lg">
          <Checkbox checked={look.bold} onChange={(bold) => patch({ bold })}>
            {t("export.design.bold")}
          </Checkbox>
          <Checkbox checked={look.italic} onChange={(italic) => patch({ italic })}>
            {t("export.design.italic")}
          </Checkbox>
          <Checkbox checked={look.underline} onChange={(underline) => patch({ underline })}>
            {t("export.design.underline")}
          </Checkbox>
        </Stack>
        {ratio < MIN_CONTRAST ? (
          <Notice $tone="warning" role="status">
            <TriangleAlert size={ICON_SIZE} aria-hidden />
            {t("export.design.lowContrast", { ratio: ratio.toFixed(RATIO_DECIMALS), min: MIN_CONTRAST })}
          </Notice>
        ) : null}
      </Stack>
    </Disclosure>
  );
}

/** The four styled parts of the sheet, each in its own collapsible section. */
export function DesignEditor({ design, onChange }: { design: FileDesign; onChange: (design: FileDesign) => void }) {
  const { t } = useI18n();
  return (
    <Stack $gap="sm">
      {DESIGN_SECTIONS.map((section, index) => (
        <SectionEditor
          key={section}
          title={t(`export.design.section.${section}`)}
          look={design[section]}
          open={index === 0}
          onChange={(look) => onChange({ ...design, [section]: look })}
        />
      ))}
    </Stack>
  );
}
