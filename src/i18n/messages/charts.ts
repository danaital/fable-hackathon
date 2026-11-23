const en = {
  "charts.default.byField": "Rows by {field}",
  "charts.default.byMonth": "Rows per month, by {field}",
  "charts.subtitle.count": "Number of rows by {category}",
  "charts.subtitle.series.count": "Number of rows by {category}, split by {series}",
  "charts.subtitle.series.sum": "Sum of {field} by {category}, split by {series}",
  "charts.subtitle.series.average": "Average {field} by {category}, split by {series}",
  "charts.ignoresFilters": "All rows, ignores the filters",
  "charts.legend.item": "{label} in {title}",
  "charts.legend.itemHidden": "{label} in {title}, hidden",
  "charts.tooltip.point": "Point {n}",
  "charts.tooltip.xy": "X: {x}, Y: {y}",
  "charts.total": "Total",
  "charts.note.step.month": "Grouped by month: the rows cover a short period",
  "charts.note.step.week": "Grouped by week, each from its Monday: the rows cover a short period",
  "charts.note.step.day": "Grouped by day: the rows cover a short period",
  "charts.note.bars": "Shown as bars: one point alone makes no trend",
} as const;

const he: Record<keyof typeof en, string> = {
  "charts.default.byField": "שורות לפי {field}",
  "charts.default.byMonth": "שורות לפי חודש, לפי {field}",
  "charts.subtitle.count": "מספר השורות לפי {category}",
  "charts.subtitle.series.count": "מספר השורות לפי {category}, בחלוקה לפי {series}",
  "charts.subtitle.series.sum": "סכום {field} לפי {category}, בחלוקה לפי {series}",
  "charts.subtitle.series.average": "ממוצע {field} לפי {category}, בחלוקה לפי {series}",
  "charts.ignoresFilters": "כל השורות, ללא הסינונים",
  "charts.legend.item": "{label} בתרשים {title}",
  "charts.legend.itemHidden": "{label} בתרשים {title}, מוסתר",
  "charts.tooltip.point": "נקודה {n}",
  "charts.tooltip.xy": "X: {x}, Y: {y}",
  "charts.total": "סה״כ",
  "charts.note.step.month": "מקובץ לפי חודש: השורות מכסות תקופה קצרה",
  "charts.note.step.week": "מקובץ לפי שבוע, החל מיום שני: השורות מכסות תקופה קצרה",
  "charts.note.step.day": "מקובץ לפי יום: השורות מכסות תקופה קצרה",
  "charts.note.bars": "מוצג כעמודות: נקודה אחת בלבד אינה יוצרת מגמה",
};

export const chartsMessages = { en, he };
