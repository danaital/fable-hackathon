"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import styled, { css } from "styled-components";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n";

const TabList = styled.div`
  ${({ theme: { color, space } }) => css`
    display: flex;
    gap: ${space.xs};
    overflow-x: auto;
    border-block-end: 1px solid ${color.border};
  `}
`;

// The active tab is marked by a thick underline and bold weight, not by colour alone.
const Tab = styled(Button)<{ $selected: boolean }>`
  ${({ theme: { color, font }, $selected }) => css`
    border-radius: 0;
    border-block-end: 3px solid ${$selected ? color.text : "transparent"};
    font-weight: ${$selected ? font.weight.medium : font.weight.regular};
    flex: none;
  `}
`;

const Panel = styled.div`
  ${({ theme: { space } }) => css`
    padding-block: ${space.lg};
  `}
`;

export interface TabDef<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  label: string;
  tabs: readonly TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
  children: ReactNode;
}

const STEP: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };

/** WAI-ARIA tabs: arrow keys (mirrored in RTL), Home and End move between tabs; Tab moves into the panel. */
export function Tabs<T extends string>({ label, tabs, active, onChange, children }: TabsProps<T>) {
  const { dir } = useI18n();
  const base = useId();
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const index = tabs.findIndex((tab) => tab.id === active);

  const select = (next: number) => {
    const tab = tabs[(next + tabs.length) % tabs.length];
    onChange(tab.id);
    refs.current.get(tab.id)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const step = STEP[event.key];
    if (step !== undefined) select(index + (dir === "rtl" ? -step : step));
    else if (event.key === "Home") select(0);
    else if (event.key === "End") select(tabs.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <>
      <TabList role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            ref={(element: HTMLButtonElement | null) => {
              if (element) refs.current.set(tab.id, element);
            }}
            $variant="ghost"
            $selected={tab.id === active}
            role="tab"
            id={`${base}-tab-${tab.id}`}
            aria-selected={tab.id === active}
            aria-controls={`${base}-panel`}
            tabIndex={tab.id === active ? 0 : -1}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </Tab>
        ))}
      </TabList>
      <Panel role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${active}`} tabIndex={0}>
        {children}
      </Panel>
    </>
  );
}
