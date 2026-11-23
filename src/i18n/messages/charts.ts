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
};

export const chartsMessages = { en, he };
