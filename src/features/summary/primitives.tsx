"use client";

import styled, { css, keyframes } from "styled-components";
import { Button, Card, Grid } from "@/components/ui";
import type { ToneName } from "@/styles/theme";

// Styled primitives of the summary feature. Feature components compose these and the shared ones; no raw tags there.

const STRIPE_WIDTH = "4px";
const WIDGET_MIN_HEIGHT = "168px";
const SKELETON_HEIGHT = "72px";
const BADGE_SIZE = "24px";
const RANK_LIST_MAX_HEIGHT = "260px";
const WIDGET_MIN_WIDTH = "250px";
const SWATCH_SIZE = "16px";
const LEGEND_MAX_HEIGHT = "220px";
const PIE_LEGEND_WIDTH = "200px";
/** Share-of-top tint of a ranking badge: never fainter than the minimum; light text once it passes the switch point. */
const MIN_TINT = 30;
const LIGHT_TEXT_FROM = 60;
const PODIUM_TONES: readonly ToneName[] = ["warning", "neutral", "info"];

export const Section = styled.section`
  ${({ theme: { space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.md};
  `}
`;

/** Card grid: as many columns as fit, and always one column on phones. */
export const WidgetGridBox = styled(Grid).attrs({ $min: WIDGET_MIN_WIDTH })`
  ${({ theme: { bp } }) => css`
    @media (max-width: ${bp.mobile}) {
      grid-template-columns: minmax(0, 1fr);
    }
  `}
`;

export const CardShell = styled(Card)<{ $tone?: ToneName; $wide?: boolean }>`
  ${({ theme: { color, space, bp }, $tone, $wide }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.sm};
    min-block-size: ${WIDGET_MIN_HEIGHT};
    border-inline-start: ${STRIPE_WIDTH} solid ${$tone ? color[$tone].fg : color.accent};
    /* Dims only when a recalculation takes long enough to notice; a quick one shows no flicker. */
    &[aria-busy="true"] {
      opacity: 0.7;
      transition: opacity 200ms ease-in 200ms;
    }
    @media (min-width: ${bp.mobile}) {
      ${$wide ? "grid-column: span 2;" : ""}
    }
    @media (hover: hover) and (prefers-reduced-motion: no-preference) {
      transition: transform 120ms ease-out;
      &:hover {
        transform: translateY(-2px);
        border-color: ${color.text};
        border-inline-start-color: ${$tone ? color[$tone].fg : color.accent};
      }
    }
  `}
`;

export const CardHeader = styled.div`
  ${({ theme: { color, space } }) => css`
    display: flex;
    align-items: flex-start;
    gap: ${space.sm};
    padding-block-end: ${space.sm};
    border-block-end: 1px solid ${color.border};
  `}
`;

export const IconBadge = styled.span<{ $tone?: ToneName }>`
  ${({ theme: { color, radius, size }, $tone = "neutral" }) => css`
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    inline-size: ${size.control};
    block-size: ${size.control};
    border-radius: ${radius.md};
    background: ${color[$tone].bg};
    color: ${color[$tone].fg};
  `}
`;

/** A button that stays focusable while unavailable, so its label can explain why. */
export const ActionButton = styled(Button)`
  &[aria-disabled="true"] {
    cursor: not-allowed;
    opacity: 0.55;
  }
`;

/** Mirrors a directional icon (arrow, trend line) in right-to-left pages. */
export const Flip = styled.span`
  display: inline-flex;
  [dir="rtl"] & {
    transform: scaleX(-1);
  }
`;

const pulse = keyframes`
  50% { opacity: 0.45; }
`;

export const Skeleton = styled.div`
  ${({ theme: { color, radius } }) => css`
    flex: 1 1 auto;
    min-block-size: ${SKELETON_HEIGHT};
    border-radius: ${radius.md};
    background: ${color.surfaceAlt};
    animation: ${pulse} 1.4s ease-in-out infinite;
  `}
`;

export const ValueText = styled.span<{ $small?: boolean }>`
  ${({ theme: { font }, $small }) => css`
    /* The value sits in the middle of the space the card has left, both ways. */
    display: flex;
    /* A lone value fills the card; a small one stays with its label so the pair is centred together. */
    flex: ${$small ? "0 0 auto" : "1 1 auto"};
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: ${$small ? font.size.xl : font.size.xxl};
    font-weight: ${font.weight.medium};
    line-height: 1.2;
    overflow-wrap: anywhere;
  `}
`;

export const Separator = styled.span`
  ${({ theme: { color } }) => css`
    align-self: stretch;
    inline-size: 1px;
    background: ${color.border};
  `}
`;

export const SummaryBox = styled.div`
  ${({ theme: { color, radius, space } }) => css`
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: ${space.xs};
    padding: ${space.md};
    border-radius: ${radius.md};
    background: ${color.surfaceAlt};
    min-inline-size: 0;
  `}
`;

export const RankList = styled.ol<{ $tall?: boolean }>`
  ${({ theme: { space }, $tall }) => css`
    flex: 1 1 0;
    display: flex;
    flex-direction: column;
    gap: ${space.xs};
    min-inline-size: 0;
    max-block-size: ${$tall ? "none" : RANK_LIST_MAX_HEIGHT};
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  `}
`;

export const RankItem = styled.li`
  ${({ theme: { font, space } }) => css`
    display: flex;
    align-items: center;
    gap: ${space.sm};
    font-size: ${font.size.sm};
    text-align: start;
  `}
`;

export const RankLabel = styled.span`
  flex: 1 1 auto;
  min-inline-size: 0;
  overflow-wrap: anywhere;
`;

/** Position badge. Places 1 to 3 use fixed tones; later places are tinted by their share of the top value (0 to 1). */
export const PlaceBadge = styled.span<{ $place: number; $share: number }>`
  ${({ theme: { color, font, radius }, $place, $share }) => {
    const tone = PODIUM_TONES[$place - 1];
    const tint = Math.max(MIN_TINT, Math.round($share * 100));
    return css`
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      min-inline-size: ${BADGE_SIZE};
      block-size: ${BADGE_SIZE};
      border-radius: ${radius.sm};
      font-size: ${font.size.xs};
      font-weight: ${font.weight.medium};
      background: ${tone ? color[tone].bg : `color-mix(in srgb, ${color.primary} ${tint}%, ${color.surface})`};
      color: ${tone ? color[tone].fg : tint > LIGHT_TEXT_FROM ? color.onPrimary : color.text};
    `;
  }}
`;

// Legend primitives: used by the chart cards in ./charts.
export const LegendList = styled.ul<{ $column?: boolean }>`
  ${({ theme: { space, bp }, $column }) => css`
    display: flex;
    flex-flow: ${$column ? "column nowrap" : "row wrap"};
    gap: ${space.xs};
    margin: 0;
    padding: 0;
    list-style: none;
    ${$column ? `flex: none; inline-size: ${PIE_LEGEND_WIDTH}; max-block-size: ${LEGEND_MAX_HEIGHT}; overflow-y: auto;` : ""}
    @media (max-width: ${bp.tablet}) {
      inline-size: auto;
    }
  `}
`;

export const LegendItem = styled.li`
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

/** Scroll and focus target placed just above the table. */
export const TableAnchor = styled.span`
  display: block;
  scroll-margin-block-start: 80px;
`;
