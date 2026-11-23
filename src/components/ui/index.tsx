"use client";

import NextLink from "next/link";
import styled, { css } from "styled-components";
import type { AppTheme, ToneName } from "@/styles/theme";

type SpaceKey = keyof AppTheme["space"];
type SizeKey = keyof AppTheme["font"]["size"];

interface StackProps {
  $row?: boolean;
  $gap?: SpaceKey;
  $align?: "start" | "center" | "end" | "baseline" | "stretch";
  $justify?: "start" | "center" | "end" | "space-between";
  $wrap?: boolean;
  $grow?: boolean;
}

export const Stack = styled.div<StackProps>`
  ${({ theme: { space }, $row, $gap = "md", $align, $justify, $wrap, $grow }) => css`
    display: flex;
    flex-direction: ${$row ? "row" : "column"};
    gap: ${space[$gap]};
    align-items: ${$align ?? ($row ? "center" : "stretch")};
    justify-content: ${$justify ?? "start"};
    flex-wrap: ${$wrap ? "wrap" : "nowrap"};
    ${$grow ? "flex: 1 1 auto; min-width: 0;" : ""}
  `}
`;

interface TextProps {
  $muted?: boolean;
  $size?: SizeKey;
  $medium?: boolean;
}

export const Text = styled.span<TextProps>`
  ${({ theme: { color, font }, $muted, $size = "md", $medium }) => css`
    color: ${$muted ? color.textMuted : "inherit"};
    font-size: ${font.size[$size]};
    font-weight: ${$medium ? font.weight.medium : font.weight.regular};
  `}
`;

export const Paragraph = styled(Text).attrs({ as: "p" })`
  margin: 0;
`;

export const Heading = styled.h1<{ $size?: SizeKey }>`
  ${({ theme: { font }, $size = "xl" }) => css`
    margin: 0;
    font-size: ${font.size[$size]};
    font-weight: ${font.weight.medium};
    line-height: 1.25;
  `}
`;

/** Numbers, IDs and codes keep left-to-right order inside right-to-left text. */
export const Ltr = styled.span`
  direction: ltr;
  unicode-bidi: isolate;
  font-variant-numeric: tabular-nums;
`;

export const VisuallyHidden = styled.span`
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`;

export type ButtonVariant = "primary" | "accent" | "outline" | "ghost";

const BUTTON_COLORS: Record<ButtonVariant, (color: AppTheme["color"]) => string> = {
  primary: (c) => `background:${c.primary};color:${c.onPrimary};border-color:${c.primary};`,
  accent: (c) => `background:${c.accent};color:${c.onAccent};border-color:${c.accent};`,
  outline: (c) => `background:${c.surface};color:${c.text};border-color:${c.border};`,
  ghost: (c) => `background:transparent;color:${c.text};border-color:transparent;`,
};

interface ButtonStyleProps {
  $variant?: ButtonVariant;
  $icon?: boolean;
  $active?: boolean;
}

const buttonStyles = css<ButtonStyleProps>`
  ${({ theme: { color, font, radius, size, space, bp }, $variant = "outline", $icon, $active }) => css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${space.sm};
    min-block-size: ${size.control};
    min-inline-size: ${size.control};
    padding-block: 0;
    padding-inline: ${$icon ? "0" : space.md};
    border: 1px solid;
    border-radius: ${radius.sm};
    font: inherit;
    font-size: ${font.size.sm};
    font-weight: ${font.weight.medium};
    cursor: pointer;
    white-space: nowrap;
    ${BUTTON_COLORS[$variant](color)}
    ${$active ? `background:${color.surfaceAlt};border-color:${color.text};` : ""}
    &:hover:not(:disabled) {
      filter: brightness(0.96);
    }
    &:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
    @media (max-width: ${bp.mobile}) {
      min-block-size: ${size.touch};
      min-inline-size: ${size.touch};
    }
  `}
`;

export const Button = styled.button<ButtonStyleProps>`
  ${buttonStyles}
`;

/** A link that looks like a Button, for navigation that should read as an action. */
export const ButtonLink = styled(NextLink)<ButtonStyleProps>`
  ${buttonStyles}
  text-decoration: none;
`;

const fieldStyles = css`
  ${({ theme: { color, font, radius, size, space, bp } }) => css`
    min-block-size: ${size.control};
    padding-block: 0;
    padding-inline: ${space.md};
    border: 1px solid ${color.border};
    border-radius: ${radius.sm};
    background: ${color.surface};
    color: ${color.text};
    font: inherit;
    font-size: ${font.size.sm};
    @media (max-width: ${bp.mobile}) {
      min-block-size: ${size.touch};
      font-size: ${font.size.md};
    }
  `}
`;

export const Input = styled.input`
  ${fieldStyles}
  inline-size: 100%;
`;

export const Select = styled.select`
  ${fieldStyles}
`;

export const Label = styled.label`
  ${({ theme: { color, font, space } }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${space.sm};
    color: ${color.textMuted};
    font-size: ${font.size.sm};
  `}
`;

export const Card = styled.div<{ $padded?: boolean }>`
  ${({ theme: { color, radius, space }, $padded = true }) => css`
    background: ${color.surface};
    border: 1px solid ${color.border};
    border-radius: ${radius.lg};
    padding: ${$padded ? space.lg : "0"};
    min-inline-size: 0;
  `}
`;

export const Badge = styled.span<{ $tone?: ToneName }>`
  ${({ theme: { color, font, radius, space }, $tone = "neutral" }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${space.xs};
    padding-block: 2px;
    padding-inline: ${space.sm};
    border-radius: ${radius.sm};
    background: ${color[$tone].bg};
    color: ${color[$tone].fg};
    font-size: ${font.size.xs};
    font-weight: ${font.weight.medium};
    white-space: nowrap;
  `}
`;

export const Link = styled(NextLink)`
  ${({ theme: { radius } }) => css`
    color: inherit;
    text-decoration: none;
    border-radius: ${radius.sm};
    &:hover {
      text-decoration: underline;
    }
  `}
`;

export const Grid = styled.div<{ $min?: string }>`
  ${({ theme: { space }, $min = "260px" }) => css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(${$min}, 100%), 1fr));
    gap: ${space.lg};
  `}
`;

export const Notice = styled.div<{ $tone?: ToneName }>`
  ${({ theme: { color, radius, space }, $tone = "neutral" }) => css`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: ${space.md};
    padding: ${space.lg};
    border-radius: ${radius.md};
    background: ${color[$tone].bg};
    color: ${color[$tone].fg};
  `}
`;

export const TableScroll = styled.div`
  ${({ theme: { color, radius } }) => css`
    overflow-x: auto;
    border: 1px solid ${color.border};
    border-radius: ${radius.md};
    background: ${color.surface};
  `}
`;

export const Table = styled.table`
  ${({ theme: { font } }) => css`
    inline-size: 100%;
    border-collapse: collapse;
    font-size: ${font.size.sm};
  `}
`;

export const Th = styled.th`
  ${({ theme: { color, font, space } }) => css`
    position: sticky;
    inset-block-start: 0;
    padding: 0;
    background: ${color.surfaceAlt};
    color: ${color.textMuted};
    font-size: ${font.size.xs};
    font-weight: ${font.weight.medium};
    text-align: start;
    white-space: nowrap;
    border-block-end: 1px solid ${color.border};
    & > button {
      inline-size: 100%;
      justify-content: flex-start;
      border-radius: 0;
      padding-inline: ${space.md};
      color: inherit;
      font-size: inherit;
    }
  `}
`;

export const Td = styled.td<{ $end?: boolean }>`
  ${({ theme: { color, space }, $end }) => css`
    padding-block: ${space.sm};
    padding-inline: ${space.md};
    border-block-end: 1px solid ${color.border};
    text-align: ${$end ? "end" : "start"};
    white-space: nowrap;
    max-inline-size: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
  `}
`;

export const Tr = styled.tr`
  ${({ theme: { color } }) => css`
    &:hover > td {
      background: ${color.surfaceAlt};
    }
  `}
`;

export const Thead = styled.thead``;
export const Tbody = styled.tbody``;
export const Caption = styled.caption`
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
`;

export * from "./forms";
export * from "./overlay";
export * from "./toast";
export * from "./errors";
export * from "./skeleton";
