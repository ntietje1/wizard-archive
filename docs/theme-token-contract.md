# Theme Token Contract

The app theme contract lives in `src/styles/app.css`. App chrome should prefer these semantic tokens over raw palette classes, local light/dark opacity recipes, or vendor defaults. Authored content colors, such as user-picked map pin colors, may still store concrete colors.

## Current Core Families

| Family                     | Tokens                                                                                                                     | Owner                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| App surfaces               | `--background`, `--foreground`, `--card`, `--popover`, `--border`, `--input`, `--ring`                                     | Theme CSS                            |
| Actions                    | `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--destructive`, `--destructive-foreground`  | Theme CSS                            |
| Canvas text/stroke palette | `--t-gray`, `--t-brown`, `--t-orange`, `--t-yellow`, `--t-green`, `--t-blue`, `--t-purple`, `--t-pink`, `--t-red`          | Theme CSS                            |
| Canvas fill palette        | `--bg-gray`, `--bg-brown`, `--bg-orange`, `--bg-yellow`, `--bg-green`, `--bg-blue`, `--bg-purple`, `--bg-pink`, `--bg-red` | Theme CSS                            |
| Overlay chrome             | `--overlay`, `--overlay-strong`                                                                                            | Theme CSS                            |
| Map ghost state            | `--map-pin-ghost`                                                                                                          | Theme CSS                            |
| Browser/PWA chrome         | `appBrowserChromeColors`, `appThemeColorMeta`                                                                              | `src/shared/theme/browser-chrome.ts` |

## Planned P18 Token Names

These names are the migration target for later P18 slices. Add concrete CSS variables when a slice migrates the first consumer.

| Need                           | Proposed tokens                                                                                                                                                                                                      | First migration |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Toast/status feedback          | `--feedback-success`, `--feedback-success-foreground`, `--feedback-warning`, `--feedback-warning-foreground`, `--feedback-info`, `--feedback-info-foreground`, `--feedback-loading`, `--feedback-loading-foreground` | Pending         |
| Permission/view-as mode chrome | `--mode-view-as`, `--mode-view-as-foreground`, `--mode-view-as-border`                                                                                                                                               | Pending         |
| Control states                 | `--control-surface`, `--control-hover`, `--control-disabled`, `--control-focus-ring`, `--control-invalid-ring`, `--control-invalid-border`                                                                           | P18.3           |
| Item surface states            | `--item-hover`, `--item-viewing`, `--item-selected`, `--item-selected-focus`, `--item-cut`, `--item-action-hover`                                                                                                    | P18.3           |

## Migration Rules

- Text and stroke swatches use `--t-*`.
- Fill/background swatches use `--bg-*`.
- Backdrops use `--overlay` or `--overlay-strong`.
- Ghost or unavailable map pins use `--map-pin-ghost`.
- Destructive foreground text uses `--destructive-foreground`; do not substitute `--primary-foreground`.
- Browser metadata and the web manifest cannot read runtime CSS variables; use `src/shared/theme/browser-chrome.ts` for the named static hex values.
- Public routes must inherit the root theme policy; do not add local `.dark` roots.
- If a future migration needs a new color concept, add one semantic token family instead of repeating raw palette or opacity math in feature code.
