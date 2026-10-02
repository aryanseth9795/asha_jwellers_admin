/** Design tokens (UI revamp spec §6). Pure — no react-native import — so Jest can load it. */
export const colors = {
  ajNavy: "#0B1F4B",
  ssjMaroon: "#7B1E3A",
  gold: "#B8860B",
  goldDeep: "#8C5B14",
  goldSoft: "#FAF1E2",
  goldLine: "#E8D5AF",
  primary: "#007AFF",
  bg: "#F8F9FA",
  surface: "#FFFFFF",
  border: "#EEF0F2",
  text: "#1A1A1A",
  textDim: "#666666",
  textMuted: "#888888",
  danger: "#C62828",
  success: "#2E7D32",
  white: "#FFFFFF",
  backdrop: "rgba(0,0,0,0.5)",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20 } as const;
/** Type scale in sp. `hero` is only used with adjustsFontSizeToFit. */
export const fontSize = { caption: 12, body: 14, bodyLg: 15, title: 17, heading: 20, display: 26, hero: 32 } as const;

/** Text grows with the phone's font size up to this factor. */
export const MAX_FONT_SCALE = 1.3;
/** Smallest touch target. */
export const MIN_TOUCH = 44;
