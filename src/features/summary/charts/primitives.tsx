"use client";

import styled, { css } from "styled-components";
import { Th } from "@/components/ui";

// Styled primitives of the chart cards, next to the shared ones in ../primitives. Feature components use no raw tags.

const INSIGHT_STRIPE = "4px";
const TOOLTIP_MIN_WIDTH = "140px";
const TOOLTIP_MAX_WIDTH = "280px";

/** Chart (or its table) with its legend: stacked, or side by side for an enlarged pie where there is room. */
export const ChartLayout = styled.div<{ $side?: boolean }>`
  ${({ theme: { space, bp }, $side }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.md};
    min-inline-size: 0;
    @media (min-width: ${bp.tablet}) {
      ${$side ? "flex-direction: row; align-items: center;" : ""}
    }
  `}
`;

/** A small card above the chart: the same surface as the page's cards, lifted by its border and shadow in both themes. */
export const TooltipBox = styled.div`
  ${({ theme: { color, font, radius, shadow, space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.xs};
    min-inline-size: ${TOOLTIP_MIN_WIDTH};
    max-inline-size: ${TOOLTIP_MAX_WIDTH};
    padding: ${space.sm} ${space.md};
    border: 1px solid ${color.border};
    border-radius: ${radius.md};
    background: ${color.surface};
    box-shadow: ${shadow.md};
    color: ${color.text};
    font-size: ${font.size.sm};
    text-align: start;
  `}
`;

export const TooltipTitle = styled.div`
  ${({ theme: { color, font, space } }) => css`
    padding-block-end: ${space.xs};
    border-block-end: 1px solid ${color.border};
    font-weight: ${font.weight.medium};
    overflow-wrap: anywhere;
  `}
`;

export const TooltipLine = styled.div`
  ${({ theme: { space } }) => css`
    display: flex;
    align-items: center;
    gap: ${space.sm};
  `}
`;

export const TooltipName = styled.span`
  ${({ theme: { color } }) => css`
    min-inline-size: 0;
    color: ${color.textMuted};
    overflow-wrap: anywhere;
  `}
`;

/** Numbers line up at the end of the card and read left-to-right in both languages. */
export const TooltipValue = styled.span`
  ${({ theme: { font } }) => css`
    margin-inline-start: auto;
    direction: ltr;
    unicode-bidi: isolate;
    font-variant-numeric: tabular-nums;
    font-weight: ${font.weight.medium};
    white-space: nowrap;
  `}
`;

export const SwatchSvg = styled.svg`
  inline-size: 100%;
  block-size: 100%;
`;
export const SwatchRect = styled.rect``;
export const SvgDefs = styled.defs``;

export const InsightBox = styled.aside`
  ${({ theme: { color, radius, space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.xs};
    padding: ${space.sm} ${space.md};
    border-inline-start: ${INSIGHT_STRIPE} solid ${color.accent};
    border-radius: ${radius.sm};
    background: ${color.surfaceAlt};
  `}
`;

/** A header cell that holds plain text (the shared `Th` is laid out for a sort button). */
export const HeadCell = styled(Th)<{ $end?: boolean }>`
  ${({ theme: { color, space }, $end }) => css`
    padding-block: ${space.sm};
    padding-inline: ${space.md};
    color: ${color.text};
    text-align: ${$end ? "end" : "start"};
  `}
`;

// Own copies of the layout pieces the cards need, so this folder does not depend on files that are still changing.

const SWATCH_SIZE = "14px";
/** A legend row on a pointer device; touch screens get the full touch height. */
const LEGEND_ROW_HEIGHT = "28px";
const LEGEND_MAX_HEIGHT = "260px";
const PIE_LEGEND_WIDTH = "220px";
const SKELETON_HEIGHT = "280px";

export const ChartSection = styled.section`
  ${({ theme: { space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.md};
  `}
`;

export const ChartSkeleton = styled.div`
  ${({ theme: { color, radius } }) => css`
    min-block-size: ${SKELETON_HEIGHT};
    border-radius: ${radius.md};
    background: ${color.surfaceAlt};
  `}
`;

export const Figure = styled.figure`
  ${({ theme: { space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.md};
    margin: 0;
    min-inline-size: 0;
  `}
`;

export const FigCaption = styled.figcaption`
  ${({ theme: { color, font } }) => css`
    color: ${color.textMuted};
    font-size: ${font.size.sm};
  `}
`;

/** The charting library positions by physical sides, so the drawing stays left-to-right; mirroring is done through its props. */
export const ChartBox = styled.div<{ $height: number }>`
  ${({ theme: { font }, $height }) => css`
    direction: ltr;
    flex: 1 1 auto;
    min-inline-size: 0;
    block-size: ${$height}px;
    font-size: ${font.size.xs};
    /* A label at the very edge of the drawing runs into the card's padding instead of being cut off. */
    & .recharts-surface {
      overflow: visible;
    }
  `}
`;

export const LegendList = styled.ul<{ $column?: boolean }>`
  ${({ theme: { space }, $column }) => css`
    display: flex;
    flex-flow: ${$column ? "column nowrap" : "row wrap"};
    gap: 0 ${space.xs};
    margin: 0;
    padding: 0;
    list-style: none;
    ${$column ? `flex: none; inline-size: ${PIE_LEGEND_WIDTH}; max-block-size: ${LEGEND_MAX_HEIGHT}; overflow-y: auto;` : ""}
  `}
`;

export const LegendRow = styled.li`
  display: flex;
`;

export const LegendButton = styled.button`
  ${({ theme: { color, font, radius, size, space, bp } }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${space.sm};
    min-block-size: ${LEGEND_ROW_HEIGHT};
    padding-block: 0;
    padding-inline: ${space.sm};
    border: 0;
    border-radius: ${radius.sm};
    background: transparent;
    color: ${color.text};
    font: inherit;
    font-size: ${font.size.xs};
    text-align: start;
    cursor: pointer;
    &:hover {
      background: ${color.surfaceAlt};
    }
    &[aria-pressed="true"] {
      color: ${color.textMuted};
      text-decoration: line-through;
    }
    &[aria-pressed="true"] svg {
      opacity: 0.35;
    }
    @media (max-width: ${bp.mobile}) {
      min-block-size: ${size.touch};
    }
  `}
`;

/** What follows a legend label: a pie slice's part of the whole. */
export const LegendDetail = styled.span`
  ${({ theme: { color } }) => css`
    color: ${color.textMuted};
    direction: ltr;
    unicode-bidi: isolate;
    font-variant-numeric: tabular-nums;
  `}
`;

export const Swatch = styled.span`
  display: inline-flex;
  flex: none;
  inline-size: ${SWATCH_SIZE};
  block-size: ${SWATCH_SIZE};
`;

export const BulletList = styled.ul`
  ${({ theme: { font, space } }) => css`
    margin: 0;
    padding-inline-start: ${space.lg};
    font-size: ${font.size.sm};
  `}
`;

export const Bullet = styled.li``;
