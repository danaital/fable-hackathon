"use client";

import { Star } from "lucide-react";
import styled, { css } from "styled-components";
import { Button } from "@/components/ui";

// Small primitives the views screens need and the shared set does not have yet.

export const Option = styled.option``;
export const OptGroup = styled.optgroup``;

export const Form = styled.form`
  ${({ theme: { space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.lg};
  `}
`;

/** Collapsible section on the native <details> element: keyboard and screen-reader behavior come from the browser. */
export const Disclosure = styled.details`
  ${({ theme: { color, radius } }) => css`
    border: 1px solid ${color.border};
    border-radius: ${radius.md};
    background: ${color.surface};
  `}
`;

// Keeps the browser's own open/closed marker (it also flips for right-to-left), so no `display` override here.
export const DisclosureSummary = styled.summary`
  ${({ theme: { font, radius, size, space, bp } }) => css`
    padding-block: calc((${size.control} - 1.5em) / 2);
    padding-inline: ${space.md};
    border-radius: ${radius.md};
    font-size: ${font.size.sm};
    font-weight: ${font.weight.medium};
    cursor: pointer;
    @media (max-width: ${bp.mobile}) {
      padding-block: calc((${size.touch} - 1.5em) / 2);
    }
  `}
`;

export const DisclosureBody = styled.div`
  ${({ theme: { space } }) => css`
    padding-block: ${space.xs} ${space.md};
    padding-inline: ${space.md};
  `}
`;

export const List = styled.ul`
  ${({ theme: { font, space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.xs};
    margin: 0;
    padding-inline-start: ${space.lg};
    font-size: ${font.size.sm};
  `}
`;

export const ListItem = styled.li``;

export const StarIcon = styled(Star)<{ $on: boolean }>`
  ${({ theme: { color }, $on }) => css`
    color: ${$on ? color.accent : color.textMuted};
    fill: ${$on ? color.accent : "none"};
  `}
`;

export const ErrorText = styled.span`
  ${({ theme: { color, font } }) => css`
    color: ${color.danger.fg};
    font-size: ${font.size.xs};
  `}
`;

export const Fieldset = styled.fieldset`
  ${({ theme: { space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.sm};
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
  `}
`;

export const Legend = styled.legend`
  ${({ theme: { font, space } }) => css`
    padding: 0;
    margin-block-end: ${space.sm};
    font-size: ${font.size.md};
    font-weight: ${font.weight.medium};
  `}
`;

/**
 * A link that looks like a button; render it with `as={NextLink}`. The shared Link cannot be used for this:
 * its `color: inherit` would override the button colors.
 */
export const ButtonLink = styled(Button)`
  text-decoration: none;
`;
