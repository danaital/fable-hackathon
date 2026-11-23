"use client";

import { Check, Copy, ListChecks, Lock, Pencil, Trash } from "lucide-react";
import NextLink from "next/link";
import { Badge, Button, Card, Heading, Link, Paragraph, Stack, Text } from "@/components/ui";
import type { ReportDef } from "@/data/types";
import { useI18n } from "@/i18n";
import { hydrateState, reportViewHref, type ViewEntry } from "./model";
import { ButtonLink, Disclosure, DisclosureBody, DisclosureSummary, StarIcon } from "./parts";
import { viewsRepository } from "./repository";
import { ViewPreview } from "./ViewPreview";

const ICON_SIZE = 16;
export const CARD_ACTIONS = ["rename", "edit", "duplicate", "delete"] as const;
export type CardAction = (typeof CARD_ACTIONS)[number];

interface Props {
  view: ViewEntry;
  report: ReportDef;
  /** This is the view the user chose to open first on the report. */
  isDefault: boolean;
  isFavorite: boolean;
  onAction: (action: CardAction, view: ViewEntry) => void;
}

/** One saved view on the "My views" page. System views can be opened, starred, made the default and duplicated only. */
export function ViewCard({ view, report, isDefault, isFavorite, onAction }: Props) {
  const { t } = useI18n();
  const { name } = view;

  return (
    <Card as="article">
      <Stack $gap="md">
        <Stack $row $gap="sm" $align="start">
          <Stack $gap="xs" $grow>
            <Heading as="h3" $size="lg">
              {/* dir="auto": a name in the other script keeps its own direction. */}
              <Link href={reportViewHref(view)} dir="auto">
                {name}
              </Link>
            </Heading>
            {view.description ? (
              <Paragraph $muted $size="sm" dir="auto">
                {view.description}
              </Paragraph>
            ) : null}
          </Stack>
          <Button
            $variant="ghost"
            $icon
            aria-pressed={isFavorite}
            aria-label={t(isFavorite ? "views.favorite.remove" : "views.favorite.add", { name })}
            onClick={() => viewsRepository.toggleFavorite(view.id)}
          >
            <StarIcon $on={isFavorite} size={ICON_SIZE} aria-hidden />
          </Button>
        </Stack>

        {view.system || isDefault ? (
          <Stack $row $wrap $gap="sm">
            {view.system ? (
              <Badge $tone="info">
                <Lock size={ICON_SIZE} aria-hidden />
                {t("views.card.system")}
              </Badge>
            ) : null}
            {isDefault ? (
              <Badge $tone="success">
                <Check size={ICON_SIZE} aria-hidden />
                {t("views.card.default")}
              </Badge>
            ) : null}
          </Stack>
        ) : null}

        <Stack $row $wrap $gap="sm">
          <ButtonLink as={NextLink} href={reportViewHref(view)} $variant="primary" aria-label={t("views.card.open", { name })}>
            {t("views.card.openShort")}
          </ButtonLink>
          <Button
            aria-label={t(isDefault ? "views.card.clearDefaultFor" : "views.card.setDefaultFor", { name })}
            onClick={() => viewsRepository.setDefault(report.id, isDefault ? null : view.id)}
          >
            <ListChecks size={ICON_SIZE} aria-hidden />
            {t(isDefault ? "views.card.clearDefault" : "views.card.setDefault")}
          </Button>
          {view.system ? null : (
            <>
              <Button aria-label={t("views.card.renameFor", { name })} onClick={() => onAction("rename", view)}>
                <Pencil size={ICON_SIZE} aria-hidden />
                {t("action.rename")}
              </Button>
              <Button aria-label={t("views.card.editFor", { name })} onClick={() => onAction("edit", view)}>
                {t("action.edit")}
              </Button>
            </>
          )}
          <Button aria-label={t("views.card.duplicateFor", { name })} onClick={() => onAction("duplicate", view)}>
            <Copy size={ICON_SIZE} aria-hidden />
            {t("action.duplicate")}
          </Button>
          {view.system ? null : (
            <Button aria-label={t("views.card.deleteFor", { name })} onClick={() => onAction("delete", view)}>
              <Trash size={ICON_SIZE} aria-hidden />
              {t("action.delete")}
            </Button>
          )}
        </Stack>

        <Disclosure>
          <DisclosureSummary>{t("views.card.preview")}</DisclosureSummary>
          <DisclosureBody>
            <Stack $gap="sm">
              <Text $muted $size="sm">
                {t("views.card.previewHint")}
              </Text>
              <ViewPreview report={report} state={hydrateState(report, view.state)} />
            </Stack>
          </DisclosureBody>
        </Disclosure>
      </Stack>
    </Card>
  );
}
