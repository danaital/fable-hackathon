"use client";

import { Logo } from "@/components/shell/Logo";
import { Badge, Card, Heading, Ltr, Paragraph, Stack, Text } from "@/components/ui";
import { useI18n } from "@/i18n";

/** App name, tagline and the running version. Release notes join once the version store exists. */
export function About({ version }: { version: string }) {
  const { t } = useI18n();

  return (
    <Stack $gap="lg">
      <Heading>{t("about.title")}</Heading>
      <Card>
        <Stack $gap="md">
          <Stack $row $gap="sm">
            <Logo />
            <Text $size="lg" $medium>
              {t("app.name")}
            </Text>
          </Stack>
          <Paragraph $muted>{t("app.tagline")}</Paragraph>
          <Stack $row $wrap $gap="sm">
            <Text $muted $size="sm">
              {t("about.version")}
            </Text>
            <Badge>
              <Ltr>{version}</Ltr>
            </Badge>
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}
