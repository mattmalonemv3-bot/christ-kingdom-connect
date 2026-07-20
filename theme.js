// theme.js
// Shared design tokens — matches the visual direction from the
// original mockup. Import these instead of hardcoding hex values so
// new screens stay visually consistent.

export const colors = {
  bg: "#0A0A0E",
  surface: "#101015",
  border: "#24242C",
  borderGold: "#3A3020",
  text: "#F2EFE9",
  textMuted: "#9A98A6",
  textFaint: "#5A5866",
  gold: "#C9A45C",
  goldBright: "#E4C079",
  goldDim: "#8A7440",
  danger: "#C0483E",
  dangerBg: "#3D1219",
};

export const avatarTones = ["#101B33", "#3D1219", "#0F2318", "#25101F", "#161821"];

export function toneForId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % avatarTones.length;
  return avatarTones[hash];
}

export function initialsFor(name) {
  return (name || "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
