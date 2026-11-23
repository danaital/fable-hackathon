"use client";

import styled, { css } from "styled-components";

const CELL = 10;
const STEP = 13;
const VIEW = 36;
const CENTER = 4;
const CELLS = Array.from({ length: 9 }, (_, i) => ({ i, x: (i % 3) * STEP, y: Math.floor(i / 3) * STEP }));

const Mark = styled.svg`
  ${({ theme: { color } }) => css`
    inline-size: 28px;
    block-size: 28px;
    flex: none;
    color: ${color.text};
    & [data-lit] {
      fill: ${color.accent};
    }
  `}
`;

/** A grid with one lit cell. Symmetric, so it needs no mirrored version in RTL. */
export function Logo() {
  return (
    <Mark viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden focusable="false">
      {CELLS.map(({ i, x, y }) => (
        <rect key={i} x={x} y={y} width={CELL} height={CELL} rx={2} fill="currentColor" data-lit={i === CENTER ? "" : undefined} />
      ))}
    </Mark>
  );
}
