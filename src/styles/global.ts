"use client";

import { createGlobalStyle, css } from "styled-components";

export const GlobalStyle = createGlobalStyle`
  ${({ theme: { color, font } }) => css`
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    html,
    body {
      margin: 0;
      padding: 0;
    }
    body {
      background: ${color.bg};
      color: ${color.text};
      font-family: ${font.family};
      font-size: ${font.size.md};
      font-weight: ${font.weight.regular};
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    :focus-visible {
      outline: 2px solid ${color.focus};
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      * {
        animation: none !important;
        transition: none !important;
      }
    }
  `}
`;
