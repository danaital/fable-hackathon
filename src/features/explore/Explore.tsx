"use client";

import {
  Ban,
  Boxes,
  LifeBuoy,
  Package,
  ReceiptText,
  Star,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import styled, { css } from "styled-components";
import {
  Badge,
  Button,
  Card,
  Grid,
  Heading,
  Input,
  Link,
  Ltr,
  Notice,
  Paragraph,
  Stack,
  Text,
  VisuallyHidden,
} from "@/components/ui";
import { TAGS, type ReportDef, type ReportIcon, type Tag } from "@/data/types";
import { useI18n } from "@/i18n";
import { useFavorites } from "./favorites";
import {
  TAG_RELATIONS,
  deadEndTags,
  matchReports,
  type TagRelation,
} from "./match";

const ICONS: Record<ReportIcon, LucideIcon> = {
  orders: Package,
  customers: Users,
  invoices: ReceiptText,
  shipments: Truck,
  tickets: LifeBuoy,
  products: Boxes,
};
const SEARCH_ID = "explore-search";
const ICON_SIZE = 20;
const STAR_SIZE = 18;
const NO_MATCH_ICON = 14;
const RELATION_LABEL: Record<
  TagRelation,
  "explore.relation.and" | "explore.relation.or"
> = {
  and: "explore.relation.and",
  or: "explore.relation.or",
};

// The whole card opens the report: the title link stretches over it; the star button sits above that layer.
const ReportCardBox = styled(Card)`
  ${({ theme: { color } }) => css`
    position: relative;
    &:hover,
    &:focus-within {
      border-color: ${color.text};
    }
  `}
`;

const CardLink = styled(Link)`
  &::after {
    content: "";
    position: absolute;
    inset: 0;
  }
`;

const AboveLink = styled.span`
  position: relative;
  z-index: 1;
`;

const IconTile = styled.span`
  ${({ theme: { color, radius, size } }) => css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: ${size.control};
    block-size: ${size.control};
    border-radius: ${radius.md};
    background: ${color.surfaceAlt};
    flex: none;
  `}
`;

const StarIcon = styled(Star)<{ $on: boolean }>`
  ${({ theme: { color }, $on }) => css`
    color: ${$on ? color.accent : color.textMuted};
    fill: ${$on ? color.accent : "none"};
  `}
`;

interface ReportCardProps {
  report: ReportDef;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
}

function ReportCard({ report, favorite, onToggleFavorite }: ReportCardProps) {
  const { t } = useI18n();
  const Icon = ICONS[report.icon];
  const title = t(report.titleKey);

  return (
    <ReportCardBox as="article">
      <Stack $gap="md">
        <Stack $row $gap="md" $align="start">
          <IconTile>
            <Icon size={ICON_SIZE} aria-hidden />
          </IconTile>
          <Stack $gap="xs" $grow>
            <Heading as="h3" $size="lg">
              <CardLink href={`/report/${report.id}/summary`}>{title}</CardLink>
            </Heading>
            <Paragraph $muted $size="sm">
              {t(report.descKey)}
            </Paragraph>
          </Stack>
          <AboveLink>
            <Button
              $variant="ghost"
              $icon
              aria-pressed={favorite}
              aria-label={t(
                favorite ? "explore.favorite.remove" : "explore.favorite.add",
                { name: title },
              )}
              onClick={() => onToggleFavorite(report.id)}
            >
              <StarIcon $on={favorite} size={STAR_SIZE} aria-hidden />
            </Button>
          </AboveLink>
        </Stack>
        <Stack $row $wrap $gap="sm">
          {report.tags.map((tag) => (
            <Badge key={tag}>{t(`tag.${tag}`)}</Badge>
          ))}
        </Stack>
        <Text $muted $size="xs">
          <Ltr>{t("explore.fields", { count: report.fields.length })}</Ltr>
        </Text>
      </Stack>
    </ReportCardBox>
  );
}

export function Explore({ reports }: { reports: readonly ReportDef[] }) {
  const { t } = useI18n();
  const { favorites, toggleFavorite } = useFavorites();
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<ReadonlySet<Tag>>(new Set());
  const [relation, setRelation] = useState<TagRelation>("and");

  const searchText = useMemo(
    () =>
      new Map(
        reports.map((report) => [
          report.id,
          `${t(report.titleKey)} ${t(report.descKey)} ${report.tags.map((tag) => t(`tag.${tag}`)).join(" ")}`.toLowerCase(),
        ]),
      ),
    [reports, t],
  );
  const matchInput = {
    reports,
    searchText,
    term: search,
    tags: activeTags,
    relation,
  };
  const matches = matchReports(matchInput);
  const deadEnds = deadEndTags({ ...matchInput, candidates: TAGS });

  const favoriteReports = matches.filter((report) => favorites.has(report.id));

  const toggleTag = (tag: Tag) =>
    setActiveTags((current) => {
      const next = new Set(current);
      if (!next.delete(tag)) next.add(tag);
      return next;
    });

  const renderCards = (items: readonly ReportDef[]) => (
    <Grid $min="300px">
      {items.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
          favorite={favorites.has(report.id)}
          onToggleFavorite={toggleFavorite}
        />
      ))}
    </Grid>
  );

  return (
    <Stack $gap="xl">
      <Stack $gap="md">
        <Heading>{t("explore.title")}</Heading>
        <VisuallyHidden as="label" htmlFor={SEARCH_ID}>
          {t("explore.search")}
        </VisuallyHidden>
        <Input
          id={SEARCH_ID}
          type="search"
          value={search}
          placeholder={t("explore.search")}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Stack $row $wrap $gap="sm" role="group" aria-label={t("explore.tags")}>
          {TAGS.map((tag) => {
            const deadEnd = deadEnds.has(tag);
            return (
              <Button
                key={tag}
                $active={activeTags.has(tag)}
                aria-pressed={activeTags.has(tag)}
                aria-description={deadEnd ? t("explore.noMatch") : undefined}
                title={deadEnd ? t("explore.noMatch") : undefined}
                onClick={() => toggleTag(tag)}
              >
                {deadEnd ? <Ban size={NO_MATCH_ICON} aria-hidden /> : null}
                {t(`tag.${tag}`)}
              </Button>
            );
          })}
        </Stack>
        <Stack $row $wrap $gap="sm" $justify="space-between">
          <Stack
            $row
            $wrap
            $gap="sm"
            role="radiogroup"
            aria-label={t("explore.tagRelation")}
          >
            <Text $muted $size="sm" aria-hidden>
              {t("explore.tagRelation")}
            </Text>
            {TAG_RELATIONS.map((option) => (
              <Button
                key={option}
                role="radio"
                aria-checked={relation === option}
                $active={relation === option}
                onClick={() => setRelation(option)}
              >
                {t(RELATION_LABEL[option])}
              </Button>
            ))}
            {activeTags.size > 0 ? (
              <Button $variant="ghost" onClick={() => setActiveTags(new Set())}>
                {t("explore.clearTags")}
              </Button>
            ) : null}
          </Stack>
          <Text $muted $size="sm" role="status">
            {t("explore.results", { count: matches.length })}
          </Text>
        </Stack>
      </Stack>

      {favoriteReports.length > 0 ? (
        <Stack as="section" $gap="md">
          <Heading as="h2" $size="lg">
            {t("explore.favorites")}
          </Heading>
          {renderCards(favoriteReports)}
        </Stack>
      ) : null}

      <Stack as="section" $gap="md">
        <Heading as="h2" $size="lg">
          {t("explore.all")}
        </Heading>
        {matches.length === 0 ? (
          <Notice>{t("explore.empty")}</Notice>
        ) : (
          renderCards(matches)
        )}
      </Stack>
    </Stack>
  );
}
