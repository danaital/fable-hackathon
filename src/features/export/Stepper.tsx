"use client";

import styled, { css } from "styled-components";
import { Button, Text } from "@/components/ui";
import { useI18n } from "@/i18n";
import type { StepId } from "./schema";
import { STEP_VIEWS } from "./steps/registry";
import { ICON_SIZE } from "./ui";

const Nav = styled.nav`
  ${({ theme: { bp } }) => css`
    @media (max-width: ${bp.mobile}) {
      display: none;
    }
  `}
`;

// Flex row follows the page direction, so the steps run right to left in Hebrew without extra rules.
const List = styled.ol`
  ${({ theme: { space } }) => css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${space.xs};
    margin: 0;
    padding: 0;
    list-style: none;
  `}
`;

const Item = styled.li<{ $current: boolean }>`
  ${({ theme: { color, font, radius, size, space }, $current }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${space.xs};
    min-block-size: ${size.control};
    padding-inline: ${$current ? space.sm : "0"};
    border-radius: ${radius.sm};
    background: ${$current ? color.surfaceAlt : "transparent"};
    color: ${$current ? color.text : color.textMuted};
    font-size: ${font.size.sm};
    font-weight: ${$current ? font.weight.medium : font.weight.regular};
  `}
`;

const Pending = styled.span`
  ${({ theme: { size } }) => css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: ${size.control};
    opacity: 0.55;
  `}
`;

const Compact = styled(Text)`
  ${({ theme: { bp } }) => css`
    display: none;
    @media (max-width: ${bp.mobile}) {
      display: block;
    }
  `}
`;

interface Props {
  steps: readonly StepId[];
  current: StepId;
  /** Whether a completed step can be gone back to right now. */
  canJump: (step: StepId) => boolean;
  onJump: (step: StepId) => void;
}

/**
 * Wide screens: a list with one icon per step; only the current step shows its title, the others carry it as their name.
 * Phones: the list collapses to "Step 3 of 12".
 */
export function Stepper({ steps, current, canJump, onJump }: Props) {
  const { t } = useI18n();
  const position = steps.indexOf(current);

  return (
    <>
      <Nav aria-label={t("export.stepper")}>
        <List>
          {steps.map((step, index) => {
            const { titleKey, Icon } = STEP_VIEWS[step];
            const title = t(titleKey);
            if (step === current) {
              return (
                <Item key={step} $current aria-current="step">
                  <Icon size={ICON_SIZE} aria-hidden />
                  {title}
                </Item>
              );
            }
            const name = t(index < position ? "export.stepper.done" : "export.stepper.pending", { title });
            return (
              <Item key={step} $current={false}>
                {index < position ? (
                  <Button $icon $variant="ghost" title={title} aria-label={name} disabled={!canJump(step)} onClick={() => onJump(step)}>
                    <Icon size={ICON_SIZE} aria-hidden />
                  </Button>
                ) : (
                  <Pending title={title} role="img" aria-label={name}>
                    <Icon size={ICON_SIZE} aria-hidden />
                  </Pending>
                )}
              </Item>
            );
          })}
        </List>
      </Nav>
      <Compact $muted $size="sm">
        {t("export.stepOf", { n: position + 1, total: steps.length })}
      </Compact>
    </>
  );
}
