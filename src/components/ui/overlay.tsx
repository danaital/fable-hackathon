"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import styled, { css } from "styled-components";
import { useI18n } from "@/i18n";
import { Button, Heading, Stack } from "./index";

const ICON_SIZE = 18;

const DialogBox = styled.dialog<{ $wide?: boolean }>`
  ${({ theme: { color, radius, space, bp }, $wide }) => css`
    inline-size: min(${$wide ? "960px" : "560px"}, calc(100vw - ${space.xl}));
    max-block-size: calc(100dvh - ${space.xl});
    padding: 0;
    border: 1px solid ${color.border};
    border-radius: ${radius.lg};
    background: ${color.surface};
    color: ${color.text};
    &::backdrop {
      background: rgb(0 0 0 / 0.5);
    }
    &[open] {
      display: flex;
      flex-direction: column;
    }
    @media (max-width: ${bp.mobile}) {
      inline-size: 100vw;
      max-inline-size: 100vw;
      max-block-size: 100dvh;
      block-size: 100dvh;
      border-radius: 0;
      border: 0;
    }
  `}
`;

const DialogHeader = styled.div`
  ${({ theme: { color, space } }) => css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${space.md};
    padding: ${space.md} ${space.lg};
    border-block-end: 1px solid ${color.border};
  `}
`;

const DialogBody = styled.div`
  ${({ theme: { space } }) => css`
    flex: 1 1 auto;
    overflow-y: auto;
    padding: ${space.lg};
  `}
`;

const DialogFooter = styled.div`
  ${({ theme: { color, space } }) => css`
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: ${space.sm};
    padding: ${space.md} ${space.lg};
    border-block-start: 1px solid ${color.border};
  `}
`;

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Action buttons, shown at the bottom. */
  footer?: ReactNode;
  $wide?: boolean;
}

/**
 * Modal dialog on the native <dialog> element: focus trap, Escape to close and
 * background inertness come from the browser. Full screen on phones.
 */
export function Dialog({ open, onClose, title, children, footer, $wide }: DialogProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <DialogBox ref={ref} $wide={$wide} aria-labelledby={titleId} onClose={onClose}>
      {open ? (
        <>
          <DialogHeader>
            <Heading as="h2" $size="lg" id={titleId}>
              {title}
            </Heading>
            <Button $variant="ghost" $icon aria-label={t("action.close")} onClick={onClose}>
              <X size={ICON_SIZE} aria-hidden />
            </Button>
          </DialogHeader>
          <DialogBody>
            <Stack $gap="lg">{children}</Stack>
          </DialogBody>
          {footer ? <DialogFooter>{footer}</DialogFooter> : null}
        </>
      ) : null}
    </DialogBox>
  );
}
