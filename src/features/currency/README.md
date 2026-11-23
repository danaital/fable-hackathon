# Currency

Converts money fields (`FieldDef.type === "currency"` with a `currencyKey` code column) into a display currency, using daily reference rates from Frankfurter through the server route `GET /api/rates`. The browser never calls the provider.

Import pure helpers from `@/features/currency/convert` (safe in engines and tests) and hooks and components from `@/features/currency` (the barrel).

## Settings it reads

`CurrencySettings` lives in `@/features/settings/schema`, resolved per member: report override, then user settings, then defaults (`useEffectiveSettings(reportId)`).

| Member | Values | Meaning |
|---|---|---|
| `selectedCurrency` | `"row"`, `ILS`, `USD`, `EUR`, `GBP` | `"row"` keeps every row in its own currency (no conversion). Default `"row"`. |
| `displayMode` | `dynamic`, `semiConverted`, `staticConverted`, `static` | `dynamic`: convert at the rate timing. `semiConverted`: same, and the cell also shows the original. `staticConverted`: convert every row at one fixed date (`customExchangeDate`). `static`: never convert. |
| `exchangeRateTiming` | `timePeriod`, `dateField`, `custom` | Which day's rate: a moving period, each row's own date field (per report only), or one custom date. |
| `currencyTimePeriod` | `today`, `yesterday`, `lastTradeDay`, `nextTradeDay`, `thisDayLastWeek`, `custom` | Trade days skip Saturday and Sunday. Future days use the latest rate. |
| `customExchangeDate` | `YYYY-MM-DD` or null | Required by custom timing, custom period and `staticConverted` (`customDateProblem`). |
| `dateFieldForConversion` | a date or datetime field key | Used by `dateField` timing. An empty cell uses the latest rate; an unparsable one has no rate. |

"Use my settings" in the report drawer stores nothing (absent = inherit), which is what the spec's `default` and `inheritFromSettings` sentinels meant.

## Rules

- Same currency: no rate needed, value unchanged.
- Missing rate (provider has none, request failed, unknown code, date before 1999-01-04, unparsable row date): the original amount and currency are kept and flagged `missingRate`. Never a wrong number.
- `converted = amount × rate`, no rounding; formatters round for display.
- Weekends and holidays get the provider's previous business day; `rateDate` reports the day actually used.
- Fields that share one code column convert together or not at all, so amount and code never disagree.

## API

```ts
// Pure (src/features/currency/convert.ts)
convertAmount({ amount, from, to, rateDate, rates }): AmountConversion
//   AmountConversion = { value, currency, converted, missingRate, rate, rateDate }
convertRows({ rows, fields, currency, rates?, now? }): readonly Row[]   // same array back when nothing converts
getConversion(row, fieldKey): RowConversion | undefined                 // details for a row convertRows produced
rateRequestsFor({ rows, fields, currency, now? }): RateRequest[]        // the (base, date) pairs convertRows needs
resolveRateDate({ currency, row, now }): string | null                  // "YYYY-MM-DD", "latest", or null = no rate
targetCurrency(currency): string | null                                 // null = rows keep their own currency
summarizeCurrency({ rows, field }): { status: "total", currency } | { status: "mixed", currencies }
rateKey(base, date)                                                     // key of a RateTable entry

// Hooks and components (client)
useRates(requests: RateRequest[]): { rates: RateTable, status: "loading" | "ready" | "error", retry }
<CurrencyProvider report={report} rows={rawRows}>                        // loads the rates the rows need
useCurrency(): { settings, target, status, isConverting, rates, retry, convert({ amount, from, row }) }
<CurrencyAmount row={row} field={field} format={format} />               // money cell for the current display mode
<CurrencyFields value effective inherited? fields? onChange />           // full currency settings form (settings page, report drawer)
<CurrencyControl />                                                       // compact toolbar control: this report's display currency and rate period
<CurrencyNotice />                                                        // loading / error / missing rates / mixed currencies
```

### Converting every row (report shell)

```tsx
// ReportShell: <CurrencyProvider report={report} rows={state.rows}><ReportProvider …>
// ReportContext:
const { rates } = useCurrency();
const displayRows = useMemo(
  () => convertRows({ rows, fields: report.fields, currency: settings.currency, rates }),
  [rows, report.fields, settings.currency, rates],
);
```

### A filter in another currency ("amount > 100 EUR")

Rows from `useReport()` are already in the display currency. Convert the filter value into each row's currency at that row's rate date:

```ts
const requests = rows.map((row) => ({ base: "EUR", date: resolveRateDate({ currency, row, now }) ?? LATEST }));
const { rates, status } = useRates(requests); // fetched once per (base, date) for the whole session
const { value } = convertAmount({ amount: 100, from: "EUR", to: String(row.currency), rateDate: resolveRateDate({ currency, row, now }), rates });
```

When `missingRate` is true, keep the row (the spec's rule for filters: missing data never hides a row).

## Rate route

`GET /api/rates?base=USD&symbols=EUR,ILS&date=2026-03-01,2026-03-02,latest`

- `base`, `symbols`: provider ISO codes (`RATE_CURRENCIES`); `symbols` must not include `base`.
- `date`: up to 100 comma-separated days (`YYYY-MM-DD`, from 1999-01-04 to today UTC) or `latest`; default `latest`.
- 200 `{ base, rates: { [requestedDate]: { date, rates: { [code]: number } } } }`. Several days cost one upstream time-series call. Past days are cached in server memory and sent with `Cache-Control: immutable`; today and `latest` get a 5-minute cache.
- 400 `{ error: "invalid_query" }`, 502 `{ error: "rates_upstream_failed" }` (upstream bodies never forwarded), 503 `{ error: "rates_not_configured" }` when `FRANKFURTER_URL` is unset.

The browser (`useRates`) asks for all display currencies per (base, date), so switching the target needs no new request, and keeps answers for the session.
