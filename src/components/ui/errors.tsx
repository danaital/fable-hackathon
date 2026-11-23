"use client";

import { SearchX, TriangleAlert } from "lucide-react";
import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from "react";
import { useI18n, type I18nKey } from "@/i18n";
import { logger } from "@/lib/logger";
import { Button, ButtonLink, Card, Heading, Ltr, Paragraph, Stack, Text } from "./index";

const ICON_SIZE = 24;
const HOME = "/";
const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

/** What is safe to log about a thrown value: no response bodies, URLs or personal data. */
function errorContext(error: unknown): Record<string, string> {
  if (!(error instanceof Error)) return { name: typeof error };
  const digest = "digest" in error && typeof error.digest === "string" ? error.digest : "";
  return { name: error.name, message: error.message, digest };
}

/** Moves keyboard focus to the heading when the card appears, so the change is not missed. */
function useFocusOnMount() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return heading;
}

interface ErrorFallbackProps {
  error?: unknown;
  /** Absent hides the retry button. */
  onRetry?: () => void;
  titleKey?: I18nKey;
  messageKey?: I18nKey;
}

/** The card shown in place of a part of the page that failed: what happened, try again, back to reports. */
export function ErrorFallback({ error, onRetry, titleKey = "error.title", messageKey = "error.message" }: ErrorFallbackProps) {
  const { t } = useI18n();
  const heading = useFocusOnMount();

  return (
    <Card role="alert">
      <Stack $gap="md" $align="start">
        <Stack $row $gap="sm">
          <TriangleAlert size={ICON_SIZE} aria-hidden />
          <Heading as="h2" $size="lg" ref={heading} tabIndex={-1}>
            {t(titleKey)}
          </Heading>
        </Stack>
        <Paragraph $muted>{t(messageKey)}</Paragraph>
        {IS_DEVELOPMENT && error instanceof Error ? (
          <Text $size="xs">
            <Ltr>{error.message}</Ltr>
          </Text>
        ) : null}
        <Stack $row $wrap $gap="sm">
          {onRetry ? (
            <Button $variant="primary" onClick={onRetry}>
              {t("grid.retry")}
            </Button>
          ) : null}
          <ButtonLink href={HOME}>{t("report.back")}</ButtonLink>
        </Stack>
      </Stack>
    </Card>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Shown instead of the built-in card. */
  fallback?: ReactNode;
  onError?: (error: unknown, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  failed: boolean;
  error: unknown;
}

const NO_ERROR: ErrorBoundaryState = { failed: false, error: null };

/** Keeps a render error inside the part of the tree it wraps. Retry renders the children again. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state = NO_ERROR;

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { failed: true, error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    logger.error("ui.render-error", { ...errorContext(error), componentStack: info.componentStack ?? "" });
    this.props.onError?.(error, info);
  }

  retry = () => this.setState(NO_ERROR);

  render() {
    if (!this.state.failed) return this.props.children;
    return this.props.fallback ?? <ErrorFallback error={this.state.error} onRetry={this.retry} />;
  }
}

export interface RouteErrorProps {
  error: unknown;
  retry: () => void;
}

/** Body of the App Router error files: logs the error once and offers retry and a way back. */
export function RouteError({ error, retry, titleKey }: RouteErrorProps & { titleKey?: I18nKey }) {
  useEffect(() => {
    logger.error("ui.route-error", errorContext(error));
  }, [error]);

  return <ErrorFallback error={error} onRetry={retry} titleKey={titleKey} />;
}

/** Shown for an unknown address, signed in or not. Holds no private data. */
export function NotFound() {
  const { t } = useI18n();
  const heading = useFocusOnMount();

  return (
    <Card>
      <Stack $gap="md" $align="start">
        <Stack $row $gap="sm">
          <SearchX size={ICON_SIZE} aria-hidden />
          <Heading $size="lg" ref={heading} tabIndex={-1}>
            {t("notFound.title")}
          </Heading>
        </Stack>
        <Paragraph $muted>{t("notFound.message")}</Paragraph>
        <ButtonLink $variant="primary" href={HOME}>
          {t("report.back")}
        </ButtonLink>
      </Stack>
    </Card>
  );
}
