"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import styled, { css } from "styled-components";
import { Button, Heading } from "@/components/ui";
import { useI18n } from "@/i18n";

const ICON_SIZE = 18;
const DRAWER_WIDTH = "440px";
const BACKDROP = "rgb(0 0 0 / 0.25)";
const HAIRLINE = "1px";

const DrawerBox = styled.dialog`
  ${({ theme: { color, bp } }) => css`
    position: fixed;
    inset-block: 0;
    inset-inline: auto 0;
    margin: 0;
    inline-size: min(${DRAWER_WIDTH}, 100vw);
    max-inline-size: 100vw;
    block-size: 100dvh;
    max-block-size: 100dvh;
    padding: 0;
    border: 0;
    border-inline-start: ${HAIRLINE} solid ${color.border};
    background: ${color.surface};
    color: ${color.text};
    /* A light backdrop keeps the grid readable behind the panel, where the column preview shows. */
    &::backdrop {
      background: ${BACKDROP};
    }
    &[open] {
      display: flex;
      flex-direction: column;
    }
    @media (max-width: ${bp.mobile}) {
      inline-size: 100vw;
      border: 0;
    }
  `}
`;

const DrawerHeader = styled.div`
  ${({ theme: { color, space } }) => css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${space.md};
    padding: ${space.md} ${space.lg};
    border-block-end: ${HAIRLINE} solid ${color.border};
  `}
`;

export const DrawerBody = styled.div`
  ${({ theme: { space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.lg};
    flex: 1 1 auto;
    overflow-y: auto;
    padding: ${space.lg};
  `}
`;

export const DrawerFooter = styled.div`
  ${({ theme: { color, space } }) => css`
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: ${space.sm};
    padding: ${space.md} ${space.lg};
    border-block-start: ${HAIRLINE} solid ${color.border};
  `}
`;

interface DrawerProps {
  open: boolean;
  /** The user asked to close (Escape or the close button). The owner decides whether to close. */
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Side panel on the inline end, on the native <dialog>: the browser traps focus, makes the page inert
 * and returns focus to the opener on close. Full width on phones.
 */
export function Drawer({ open, onClose, title, children }: DrawerProps) {
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
    <DrawerBox
      ref={ref}
      aria-labelledby={titleId}
      // Escape asks instead of closing, so unsaved changes can be confirmed first.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A browser may still force the dialog shut on a repeated Escape; reopen it and ask again.
      onClose={() => {
        if (!open) return;
        ref.current?.showModal();
        onClose();
      }}
    >
      {open ? (
        <>
          <DrawerHeader>
            <Heading as="h2" $size="lg" id={titleId}>
              {title}
            </Heading>
            <Button $variant="ghost" $icon aria-label={t("action.close")} onClick={onClose}>
              <X size={ICON_SIZE} aria-hidden />
            </Button>
          </DrawerHeader>
          {children}
        </>
      ) : null}
    </DrawerBox>
  );
}
