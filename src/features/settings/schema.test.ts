import { describe, expect, it } from "vitest";
import { DEFAULT_USER_SETTINGS, resolveEffective, userSettingsSchema } from "./schema";

describe("settings resolution", () => {
  it("uses the user's values when the report has no override", () => {
    expect(resolveEffective(DEFAULT_USER_SETTINGS).formatting).toEqual(DEFAULT_USER_SETTINGS.formatting);
  });

  it("applies report overrides per member and inherits the rest", () => {
    const effective = resolveEffective(DEFAULT_USER_SETTINGS, {
      formatting: { dateFormat: "YYYY.MM.DD" },
      currency: { selectedCurrency: "EUR" },
    });
    expect(effective.formatting.dateFormat).toBe("YYYY.MM.DD");
    expect(effective.formatting.timeFormat).toBe(DEFAULT_USER_SETTINGS.formatting.timeFormat);
    expect(effective.currency.selectedCurrency).toBe("EUR");
  });

  it("treats false as a real choice, not as inherit", () => {
    const effective = resolveEffective(DEFAULT_USER_SETTINGS, { customization: { toolbarCollapsed: false } });
    expect(effective.customization.toolbarCollapsed).toBe(false);
  });

  it("fills missing sections of a stored document with defaults", () => {
    expect(userSettingsSchema.parse({ themeMode: "dark" })).toEqual({ ...DEFAULT_USER_SETTINGS, themeMode: "dark" });
  });

  it("rejects out-of-range stored values", () => {
    const bad = { ...DEFAULT_USER_SETTINGS, customization: { ...DEFAULT_USER_SETTINGS.customization, minSearch: 99 } };
    expect(userSettingsSchema.safeParse(bad).success).toBe(false);
  });

  it("resolves currency members on their own: report target, user display mode and timing", () => {
    const user = { ...DEFAULT_USER_SETTINGS, currency: { ...DEFAULT_USER_SETTINGS.currency, displayMode: "semiConverted" as const, currencyTimePeriod: "yesterday" as const } };
    const effective = resolveEffective(user, { currency: { selectedCurrency: "EUR", exchangeRateTiming: undefined } });
    expect(effective.currency).toMatchObject({ selectedCurrency: "EUR", displayMode: "semiConverted", exchangeRateTiming: "timePeriod", currencyTimePeriod: "yesterday" });
  });
});
