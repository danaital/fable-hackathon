"use client";

import { Badge, Button, Card, Heading, Ltr, Paragraph, Stack, Text } from "@/components/ui";
import { useI18n } from "@/i18n";
import { ROLE_TONE, roleLabelKey, roleSummaryKey } from "./roles";
import { RequireRole, useAuthStore, useSession } from "./session";
import { DemoBanner } from "./UserMenu";

const LOWEST_SIGNED_IN_ROLE = "viewer";

function ProfileCard() {
  const { t } = useI18n();
  const { user } = useSession();
  const store = useAuthStore();
  if (!user) return null;
  return (
    <Card>
      <Stack $gap="md">
        <Heading as="h2" $size="lg">
          {user.name}
        </Heading>
        <Text $size="sm" $muted>
          <Ltr>{user.username}</Ltr> · <Ltr>{user.email}</Ltr>
        </Text>
        <Stack $row $wrap $gap="sm">
          <Text $size="sm">{t("auth.level")}:</Text>
          <Badge $tone={ROLE_TONE[user.role]}>{t(roleLabelKey(user.role))}</Badge>
        </Stack>
        <Paragraph $size="sm">{t(roleSummaryKey(user.role))}</Paragraph>
        <Stack $row>
          <Button onClick={() => void store.signOut()}>{t("auth.signOut")}</Button>
        </Stack>
      </Stack>
    </Card>
  );
}

/** The signed-in user's own page: name, sign-in names, user level and what that level can do. */
export function Profile() {
  const { t } = useI18n();
  return (
    <Stack $gap="lg">
      <Heading>{t("auth.menu.profile")}</Heading>
      <DemoBanner />
      <RequireRole min={LOWEST_SIGNED_IN_ROLE}>
        <ProfileCard />
      </RequireRole>
    </Stack>
  );
}
