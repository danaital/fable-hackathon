"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styled, { css } from "styled-components";
import { Button, Card, Field, Heading, Input, Ltr, Notice, Stack, Text } from "@/components/ui";
import { useI18n } from "@/i18n";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "./demoSeed";
import { hasHebrew } from "./model";
import { roleLabelKey } from "./roles";
import { useAuthErrorText, useAuthStore, useSession } from "./session";
import { DemoBanner } from "./UserMenu";

const Narrow = styled.div`
  ${({ theme: { space } }) => css`
    inline-size: min(420px, 100%);
    margin-inline: auto;
    display: flex;
    flex-direction: column;
    gap: ${space.lg};
  `}
`;

const Form = styled.form`
  ${({ theme: { space } }) => css`
    display: flex;
    flex-direction: column;
    gap: ${space.lg};
  `}
`;

/** Sign-in form. `returnTo` is already checked by safeReturnPath on the server. */
export function LoginForm({ returnTo }: { returnTo: string }) {
  const { t } = useI18n();
  const { user, status } = useSession();
  const store = useAuthStore();
  const router = useRouter();
  const errorText = useAuthErrorText();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hebrew = hasHebrew(identifier) || hasHebrew(password);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!identifier.trim() || !password) {
      setError(t("auth.login.required"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      // The password is sent exactly as typed; only the identifier is trimmed.
      await store.signIn({ identifier: identifier.trim(), password });
      router.replace(returnTo);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Narrow>
      <Heading>{t("auth.login.title")}</Heading>
      <DemoBanner />
      {status === "signedIn" && user ? (
        <Notice role="status">
          <Text>{t("auth.login.already", { name: user.name })}</Text>
          <Button onClick={() => void store.signOut()}>{t("auth.signOut")}</Button>
        </Notice>
      ) : null}
      <Card>
        <Form onSubmit={(event) => void submit(event)} noValidate>
          <Field label={t("auth.login.identifier")}>
            {(id) => <Input id={id} dir="ltr" autoComplete="username" autoCapitalize="none" spellCheck={false} value={identifier} onChange={(event) => setIdentifier(event.target.value)} />}
          </Field>
          <Field label={t("auth.login.password")}>
            {(id) => (
              <Stack $row $gap="sm">
                <Input id={id} dir="ltr" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                <Button type="button" aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>
                  {t("auth.login.show")}
                </Button>
              </Stack>
            )}
          </Field>
          {hebrew ? (
            <Notice $tone="warning" role="status">
              <Text $size="sm">{t("auth.login.latin")}</Text>
            </Notice>
          ) : null}
          {error ? (
            <Notice $tone="danger" role="alert">
              <Text $size="sm">{error}</Text>
            </Notice>
          ) : null}
          <Button type="submit" $variant="primary" disabled={busy}>
            {t(busy ? "auth.login.busy" : "auth.signIn")}
          </Button>
        </Form>
      </Card>
      {store.mode === "demo" ? (
        <Card>
          <Stack $gap="sm">
            <Text $size="sm" $medium>
              {t("auth.demo.accounts")} <Ltr>{DEMO_PASSWORD}</Ltr>
            </Text>
            {DEMO_ACCOUNTS.map((account) => (
              <Text key={account.username} $size="sm">
                <Ltr>{account.username}</Ltr> · {t(roleLabelKey(account.role))}
              </Text>
            ))}
          </Stack>
        </Card>
      ) : null}
    </Narrow>
  );
}
