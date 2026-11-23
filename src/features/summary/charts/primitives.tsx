"use client";

import styled, { css } from "styled-components";
import { Th } from "@/components/ui";

// Styled primitives of the chart cards, next to the shared ones in ../primitives. Feature components use no raw tags.

const INSIGHT_STRIPE = "4px";
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

/** Inverted surface, so the tooltip stands out in both themes: dark with light text in the light theme. */
export const TooltipBox = styled.div`
  ${({ theme: { color, font, radius, space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.xs};
    max-inline-size: ${TOOLTIP_MAX_WIDTH};
    padding: ${space.sm} ${space.md};
    border-radius: ${radius.md};
    background: ${color.text};
    color: ${color.surface};
    font-size: ${font.size.sm};
    text-align: start;
  `}
`;

export const TooltipLine = styled.div`
  ${({ theme: { space } }) => css`
    display: flex;
    align-items: center;
    gap: ${space.sm};
  `}
`;

export const SwatchSvg = styled.svg`
  inline-size: 100%;
  block-size: 100%;
`;
export const SwatchRect = styled.rect``;
export const SvgDefs = styled.defs``;

/** A pie slice's two-line label: value, then share. */
export const SliceLabel = styled.text`
  ${({ theme: { color, font } }) => css`
    fill: ${color.text};
    font-size: ${font.size.xs};
  `}
`;
export const SliceLine = styled.tspan``;

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

const SWATCH_SIZE = "16px";
const LEGEND_MAX_HEIGHT = "220px";
const PIE_LEGEND_WIDTH = "200px";
const SKELETON_HEIGHT = "240px";

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
  `}
`;

export const LegendList = styled.ul<{ $column?: boolean }>`
  ${({ theme: { space }, $column }) => css`
    display: flex;
    flex-flow: ${$column ? "column nowrap" : "row wrap"};
    gap: ${space.xs};
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
    min-block-size: ${size.control};
    padding-block: 0;
    padding-inline: ${space.sm};
    border: 1px solid transparent;
    border-radius: ${radius.sm};
    background: transparent;
    color: ${color.text};
    font: inherit;
    font-size: ${font.size.sm};
    text-align: start;
    cursor: pointer;
    &:hover {
      border-color: ${color.border};
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
