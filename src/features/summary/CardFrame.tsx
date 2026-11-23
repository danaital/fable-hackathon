"use client";

import { ArrowRight, Maximize2, type LucideIcon } from "lucide-react";
import { Component, useId, useState, type ReactNode } from "react";
import { Dialog, Heading, Notice, Stack } from "@/components/ui";
import { useI18n } from "@/i18n";
import { logger } from "@/lib/logger";
import type { ToneName } from "@/styles/theme";
import { ActionButton, CardHeader, CardShell, Flip, IconBadge } from "./primitives";

const ICON_SIZE = 18;

interface BoundaryProps {
  cardId: string;
  fallback: ReactNode;
  children: ReactNode;
}

/** Keeps a crash inside one card: the rest of the grid stays up. */
class CardErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    logger.error("summary card failed to render", { card: this.props.cardId, error: error.message });
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function CardError() {
  const { t } = useI18n();
  return (
    <Notice $tone="danger" role="alert">
      {t("summary.card.error")}
    </Notice>
  );
}

interface CardFrameProps {
  id: string;
  title: string;
  icon: LucideIcon;
  tone?: ToneName;
  /** Takes two grid columns where there is room. */
  wide?: boolean;
  busy?: boolean;
  /** Extra header buttons, before enlarge and explore. */
  actions?: ReactNode;
  /** False while there is nothing worth enlarging (loading, empty, withheld). */
  canEnlarge?: boolean;
  /** Absent: the explore arrow is shown as unavailable. */
  onExplore?: () => void;
  /** The card's content; `enlarged` is true for the copy inside the dialog. */
  children: (enlarged: boolean) => ReactNode;
}

/** The shell every summary card shares: labelled group, header with enlarge and explore, and an isolated error state. */
export function CardFrame({ id, title, icon: Icon, tone, wide, busy, actions, canEnlarge = true, onExplore, children }: CardFrameProps) {
  const { t } = useI18n();
  const titleId = useId();
  const [enlarged, setEnlarged] = useState(false);
  const exploreLabel = t(onExplore ? "summary.card.explore" : "summary.card.exploreUnavailable", { title });

  return (
    <CardShell role="group" aria-labelledby={titleId} aria-busy={busy} $tone={tone} $wide={wide}>
      <CardHeader>
        <IconBadge $tone={tone}>
          <Icon size={ICON_SIZE} aria-hidden />
        </IconBadge>
        <Stack $grow $gap="xs">
          <Heading as="h3" $size="md" id={titleId}>
            {title}
          </Heading>
        </Stack>
        <Stack $row $gap="xs">
          {actions}
          <ActionButton
            $variant="ghost"
            $icon
            aria-label={t("summary.card.enlarge", { title })}
            title={t("summary.card.enlarge", { title })}
            disabled={!canEnlarge}
            onClick={() => setEnlarged(true)}
          >
            <Maximize2 size={ICON_SIZE} aria-hidden />
          </ActionButton>
          <ActionButton $variant="ghost" $icon aria-label={exploreLabel} title={exploreLabel} aria-disabled={!onExplore} onClick={onExplore}>
            <Flip>
              <ArrowRight size={ICON_SIZE} aria-hidden />
            </Flip>
          </ActionButton>
        </Stack>
      </CardHeader>
      <CardErrorBoundary cardId={id} fallback={<CardError />}>
        {children(false)}
      </CardErrorBoundary>
      <Dialog open={enlarged} onClose={() => setEnlarged(false)} title={title} $wide>
        <CardErrorBoundary cardId={id} fallback={<CardError />}>
          {enlarged ? children(true) : null}
        </CardErrorBoundary>
      </Dialog>
    </CardShell>
  );
}
