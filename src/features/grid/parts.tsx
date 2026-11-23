"use client";

import styled, { css } from "styled-components";
import { Badge, Button, Table, TableScroll, Td, Th } from "@/components/ui";
import { sortLevelStyle } from "./sortPalette";

// Layout numbers the theme has no token for. Colors, spacing and font sizes all come from the theme.
const SCROLL_MAX = "70dvh";
const SCROLL_MAX_MOBILE = "400px";
const TABLE_MIN_MOBILE = "600px";
const TRUNCATE_WIDTH = "32ch";
const HAIRLINE = "1px";
const RULE = "2px";
const HIGHLIGHT_BORDER = "3px";
const SEPARATOR_INSET = "25%";
const Z_HEAD = 2;
const Z_TOTAL = 1;
const MOTION = "120ms";

/** The table's own scroll area: tall on desktop, capped on phones, scrolling both ways. */
export const GridScroll = styled(TableScroll)`
  ${({ theme: { bp } }) => css`
    overflow: auto;
    max-block-size: ${SCROLL_MAX};
    @media (max-width: ${bp.mobile}) {
      max-block-size: ${SCROLL_MAX_MOBILE};
    }
  `}
`;

/** Stays a table on phones: denser text and a minimum width, so it scrolls sideways instead of turning into cards. */
export const GridTableBox = styled(Table)`
  ${({ theme: { bp, font } }) => css`
    /* Separate borders keep the sticky header's and totals row's borders attached while scrolling. */
    border-collapse: separate;
    border-spacing: 0;
    @media (max-width: ${bp.mobile}) {
      min-inline-size: ${TABLE_MIN_MOBILE};
      font-size: ${font.size.xs};
    }
  `}
`;

// A short fading hairline between columns; logical insets mirror it in right-to-left, and the last column has none.
const separator = css`
  ${({ theme: { color } }) => css`
    &:not(:last-child)::after {
      content: "";
      position: absolute;
      inset-block: ${SEPARATOR_INSET};
      inset-inline-end: 0;
      inline-size: ${HAIRLINE};
      background: linear-gradient(transparent, ${color.border}, transparent);
    }
  `}
`;

interface ColumnMarks {
  /** Zero-based sort priority of the column; tints it with that level's color. */
  $level?: number;
  /** The column being moved or previewed from the columns panel. */
  $highlight?: boolean;
}

export const HeadCell = styled(Th)<ColumnMarks & { $pinned: boolean }>`
  ${({ theme: { color, size, bp, mode }, $pinned, $level, $highlight }) => css`
    position: ${$pinned ? "sticky" : "relative"};
    z-index: ${Z_HEAD};
    block-size: ${size.control};
    text-align: center;
    ${$level === undefined ? "" : `background: ${sortLevelStyle(mode, $level).tint}; color: ${color.text};`}
    ${$highlight ? `background: ${color.info.bg}; color: ${color.info.fg}; border-inline: ${HIGHLIGHT_BORDER} solid ${color.primary};` : ""}
    ${separator}
    @media (max-width: ${bp.mobile}) {
      block-size: ${size.touch};
    }
  `}
`;

export const HeadInner = styled.div`
  ${({ theme: { space } }) => css`
    display: flex;
    align-items: center;
    justify-content: center;
    & > button {
      border-radius: 0;
      color: inherit;
      font-size: inherit;
    }
    & > button:first-child {
      flex: 1 1 auto;
      justify-content: inherit;
      padding-inline: ${space.md};
    }
  `}
`;

export const BodyCell = styled(Td)<ColumnMarks>`
  ${({ theme: { color, space, bp, mode }, $level, $highlight }) => css`
    position: relative;
    text-align: center;
    transition: background ${MOTION};
    ${$level === undefined ? "" : `background: ${sortLevelStyle(mode, $level).tint};`}
    ${$highlight ? `background: ${color.info.bg}; border-inline: ${HIGHLIGHT_BORDER} solid ${color.primary};` : ""}
    ${separator}
    @media (max-width: ${bp.mobile}) {
      padding-block: ${space.xs};
      padding-inline: ${space.sm};
    }
  `}
`;

/** A totals cell sticks to the bottom of the scroll area, or to the top under the header. */
export const TotalCell = styled(Td)<{ $edge: "top" | "bottom"; $underHeader: boolean }>`
  ${({ theme: { color, font, size, bp }, $edge, $underHeader }) => css`
    position: sticky;
    z-index: ${Z_TOTAL};
    block-size: ${size.control};
    background: ${color.surfaceAlt};
    font-weight: ${font.weight.medium};
    text-align: center;
    ${$edge === "bottom"
      ? `inset-block-end: 0; border-block-start: ${RULE} solid ${color.primary}; border-block-end: 0;`
      : `inset-block-start: ${$underHeader ? `calc(${size.control} + ${HAIRLINE})` : "0"}; border-block-end: ${RULE} solid ${color.primary};`}
    @media (max-width: ${bp.mobile}) {
      ${$edge === "top" && $underHeader ? `inset-block-start: calc(${size.touch} + ${HAIRLINE});` : ""}
    }
  `}
`;

/** One full-width cell: the empty message, or a notice inside the table. */
export const WideCell = styled(Td)`
  ${({ theme: { color, space } }) => css`
    padding: ${space.xl};
    color: ${color.textMuted};
    text-align: center;
    max-inline-size: none;
    white-space: normal;
  `}
`;

// The spacer height changes on every scroll step, so it is set through attrs (one class, many heights).
export const SpacerCell = styled.td.attrs<{ $height: number }>(({ $height }) => ({ style: { blockSize: `${$height}px` } }))`
  padding: 0;
  border: 0;
`;

export const Tfoot = styled.tfoot``;

/** Sort priority number, in its level's color and weight. The number carries the order; color and weight only reinforce it. */
export const PriorityBadge = styled(Badge)<{ $level: number }>`
  ${({ theme: { mode }, $level }) => {
    const { badge, onBadge, weight } = sortLevelStyle(mode, $level);
    return css`
      background: ${badge};
      color: ${onBadge};
      font-weight: ${weight};
    `;
  }}
`;

export const Mark = styled.mark`
  ${({ theme: { color, radius } }) => css`
    background: ${color.warning.bg};
    color: ${color.warning.fg};
    border-radius: ${radius.sm};
  `}
`;

export const Upper = styled.span`
  text-transform: uppercase;
`;

/** Long text is cut with an ellipsis; focusing it (Tab) shows the whole value, and the title shows it on hover. */
export const TruncText = styled.span`
  ${({ theme: { radius } }) => css`
    display: inline-block;
    max-inline-size: ${TRUNCATE_WIDTH};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
    border-radius: ${radius.sm};
    &:focus-visible {
      overflow: visible;
      white-space: normal;
      overflow-wrap: anywhere;
    }
  `}
`;

export const GroupSection = styled.section`
  ${({ theme: { color, radius } }) => css`
    border: ${HAIRLINE} solid ${color.border};
    border-radius: ${radius.md};
    background: ${color.surface};
    min-inline-size: 0;
  `}
`;

export const GroupBody = styled.div`
  ${({ theme: { space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.md};
    padding: ${space.md};
  `}
`;

/** The collapsible group heading: a full-width button whose text may wrap on narrow screens. */
export const GroupToggle = styled(Button)`
  ${({ theme: { space } }) => css`
    inline-size: 100%;
    justify-content: flex-start;
    padding-block: ${space.sm};
    white-space: normal;
    text-align: start;
  `}
`;

/** Plain inline text that keeps the table's own font size (the shared Text sets one). */
export const Plain = styled.span``;

export const Muted = styled.span`
  ${({ theme: { color } }) => css`
    color: ${color.textMuted};
  `}
`;

/** Icon or flag plus text on one line. */
export const Inline = styled.span`
  ${({ theme: { space } }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${space.xs};
  `}
`;

/** A date or date-time, with the machine-readable value in its `dateTime` attribute. */
export const Time = styled.time``;
