import type { I18nKey } from "./en";
import { adminMessages } from "./messages/admin";
import { adminToolsMessages } from "./messages/adminTools";
import { authMessages } from "./messages/auth";
import { chartsMessages } from "./messages/charts";
import { coreHe } from "./messages/core.he";
import { currencyMessages } from "./messages/currency";
import { exportMessages } from "./messages/export";
import { filtersMessages } from "./messages/filters";
import { gridMessages } from "./messages/grid";
import { insightsMessages } from "./messages/insights";
import { settingsMessages } from "./messages/settings";
import { summaryMessages } from "./messages/summary";
import { viewsMessages } from "./messages/views";

export const he: Record<I18nKey, string> = {
  ...coreHe,
  ...filtersMessages.he,
  ...summaryMessages.he,
  ...gridMessages.he,
  ...viewsMessages.he,
  ...exportMessages.he,
  ...currencyMessages.he,
  ...settingsMessages.he,
  ...insightsMessages.he,
  ...adminMessages.he,
  ...adminToolsMessages.he,
  ...chartsMessages.he,
  ...authMessages.he,
};
