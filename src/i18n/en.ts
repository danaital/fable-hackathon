import { adminMessages } from "./messages/admin";
import { adminToolsMessages } from "./messages/adminTools";
import { authMessages } from "./messages/auth";
import { chartsMessages } from "./messages/charts";
import { coreEn } from "./messages/core.en";
import { currencyMessages } from "./messages/currency";
import { exportMessages } from "./messages/export";
import { filtersMessages } from "./messages/filters";
import { gridMessages } from "./messages/grid";
import { insightsMessages } from "./messages/insights";
import { settingsMessages } from "./messages/settings";
import { summaryMessages } from "./messages/summary";
import { viewsMessages } from "./messages/views";

// One message file per feature, so features can be built in parallel without editing a shared file.
export const en = {
  ...coreEn,
  ...filtersMessages.en,
  ...summaryMessages.en,
  ...gridMessages.en,
  ...viewsMessages.en,
  ...exportMessages.en,
  ...currencyMessages.en,
  ...settingsMessages.en,
  ...insightsMessages.en,
  ...adminMessages.en,
  ...adminToolsMessages.en,
  ...chartsMessages.en,
  ...authMessages.en,
};

export type I18nKey = keyof typeof en;
