import "styled-components";
import type { AppTheme } from "./theme";

declare module "styled-components" {
  export interface DefaultTheme {
    mode: AppTheme["mode"];
    color: AppTheme["color"];
    space: AppTheme["space"];
    font: AppTheme["font"];
    radius: AppTheme["radius"];
    size: AppTheme["size"];
    shadow: AppTheme["shadow"];
    bp: AppTheme["bp"];
  }
}
