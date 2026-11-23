"use client";

import type { ReactNode } from "react";
import styled, { css, keyframes } from "styled-components";
import { useI18n, type I18nKey } from "@/i18n";
import { Card, Grid, Stack, VisuallyHidden } from "./index";

type ShapeSize = "line" | "control" | "card" | "chart";

const PULSE_SECONDS = 1.5;
const TITLE_WIDTH = "30%";
const CONTROL_WIDTH = "140px";
const WIDGET_MIN = "220px";
const CHART_MIN = "360px";
const CARD_MIN = "300px";
const TOOLBAR_CONTROLS = 4;
const WIDGETS = 4;
const TABLE_ROWS = 10;
const CHARTS = 2;
const EXPLORE_CARDS = 8;

const range = (count: number) => Array.from({ length: count }, (_, index) => index);

// Opacity only, so the shimmer needs no direction; the global reduced-motion rule switches it off.
const pulse = keyframes`
  50% { opacity: 0.45; }
`;

/** A grey placeholder block in the shape of the content that is loading. */
export const Skeleton = styled.span<{ $size?: ShapeSize; $width?: string }>`
  ${({ theme: { color, font, radius, size }, $size = "line", $width = "100%" }) => css`
    display: block;
    inline-size: ${$width};
    max-inline-size: 100%;
    block-size: ${{ line: font.size.md, control: size.control, card: size.card, chart: size.chart }[$size]};
    border-radius: ${radius.sm};
    background: ${color.neutral.bg};
    animation: ${pulse} ${PULSE_SECONDS}s ease-in-out infinite;
  `}
`;

interface LoadingRegionProps {
  children: ReactNode;
  labelKey?: I18nKey;
}

/** Marks a region busy, says "loading" once to screen readers and hides the placeholder shapes from them. */
export function LoadingRegion({ children, labelKey = "loading.page" }: LoadingRegionProps) {
  const { t } = useI18n();
  return (
    <Stack $gap="lg" aria-busy="true">
      <VisuallyHidden role="status">{t(labelKey)}</VisuallyHidden>
      <Stack $gap="lg" aria-hidden>
        {children}
      </Stack>
    </Stack>
  );
}

/** Report page while its rows load: toolbar, widget row, table, chart row. `toolbar={false}` for the part under the real toolbar. */
export function ReportSkeleton({ toolbar = true }: { toolbar?: boolean }) {
  return (
    <LoadingRegion labelKey="loading.report">
      {toolbar ? (
        <Stack $row $wrap $gap="sm">
          {range(TOOLBAR_CONTROLS).map((index) => (
            <Skeleton key={index} $size="control" $width={CONTROL_WIDTH} />
          ))}
        </Stack>
      ) : null}
      <Grid $min={WIDGET_MIN}>
        {range(WIDGETS).map((index) => (
          <Skeleton key={index} $size="card" />
        ))}
      </Grid>
      <Card>
        <Stack $gap="md">
          <Skeleton $size="control" />
          {range(TABLE_ROWS).map((index) => (
            <Skeleton key={index} />
          ))}
        </Stack>
      </Card>
      <Grid $min={CHART_MIN}>
        {range(CHARTS).map((index) => (
          <Skeleton key={index} $size="chart" />
        ))}
      </Grid>
    </LoadingRegion>
  );
}

/** The reports page while it loads: title, search box, card grid. */
export function ExploreSkeleton() {
  return (
    <LoadingRegion>
      <Skeleton $size="control" $width={TITLE_WIDTH} />
      <Skeleton $size="control" />
      <Grid $min={CARD_MIN}>
        {range(EXPLORE_CARDS).map((index) => (
          <Skeleton key={index} $size="card" />
        ))}
      </Grid>
    </LoadingRegion>
  );
}
