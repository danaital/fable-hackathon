"use client";

import { ArrowLeftRight, CircleAlert } from "lucide-react";
import styled, { css } from "styled-components";
import { Ltr, Text, VisuallyHidden } from "@/components/ui";
import type { FieldDef, Row } from "@/data/types";
import { useI18n } from "@/i18n";
import type { Formatters } from "@/lib/format";
import { getConversion, parseAmount } from "./convert";
import { useCurrency } from "./CurrencyProvider";

const ICON_SIZE = 12;
const RATE_DIGITS = 4;

const Amount = styled.span`
  ${({ theme: { space } }) => css`
    display: inline-flex;
    flex-direction: column;
    align-items: end;
    gap: ${space.xs};
  `}
`;

// Visible words, not colour alone, tell converted and unconverted amounts apart.
const Marker = styled.span`
  ${({ theme: { color, font, space } }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${space.xs};
    color: ${color.textMuted};
    font-size: ${font.size.xs};
    font-style: italic;
    cursor: help;
  `}
`;

interface CurrencyAmountProps {
  row: Row;
  field: FieldDef;
  format: Formatters;
}

/** A money cell under the current display mode: converted (with a marker), with its original beside it, or unconverted. */
export function CurrencyAmount({ row, field, format }: CurrencyAmountProps) {
  const { t } = useI18n();
  const { status, settings } = useCurrency();
  const amount = parseAmount(row[field.key]);
  if (amount === null) return null;

  const code = field.currencyKey ? row[field.currencyKey] : null;
  const shown = <Ltr>{format.currency(amount, typeof code === "string" ? code : undefined)}</Ltr>;
  const conversion = getConversion(row, field.key);
  if (!conversion || (!conversion.converted && !conversion.missingRate)) return shown;

  if (conversion.missingRate && status === "loading") {
    return (
      // One live region for loading lives in CurrencyNotice; cells stay quiet.
      <Text $muted>{t("currency.converting")}</Text>
    );
  }

  if (conversion.missingRate) {
    const detail = t("currency.noRateDetail");
    return (
      <Amount>
        {shown}
        <Marker title={detail}>
          <CircleAlert size={ICON_SIZE} aria-hidden />
          <Text aria-hidden>{t("currency.noRate")}</Text>
          <VisuallyHidden>{detail}</VisuallyHidden>
        </Marker>
      </Amount>
    );
  }

  const original = format.currency(conversion.original, conversion.source);
  const detail = t("currency.convertedDetail", {
    original,
    rate: conversion.rate?.toFixed(RATE_DIGITS) ?? "",
    date: conversion.rateDate ? format.date(conversion.rateDate) : "",
  });
  return (
    <Amount>
      {shown}
      {settings.displayMode === "semiConverted" ? (
        <Text $muted $size="xs">
          <Ltr>{t("currency.original", { amount: original })}</Ltr>
        </Text>
      ) : null}
      <Marker title={detail}>
        <ArrowLeftRight size={ICON_SIZE} aria-hidden />
        <Text aria-hidden>{t("currency.converted")}</Text>
        <VisuallyHidden>{detail}</VisuallyHidden>
      </Marker>
    </Amount>
  );
}
