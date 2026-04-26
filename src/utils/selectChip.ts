export function getChipStyle(
  value: string,
  options: string[],
  optionColors?: Record<string, string>,
): Record<string, string> {
  const explicitColor = optionColors?.[value];
  if (typeof explicitColor === "string" && explicitColor.trim().length > 0) {
    return {
      backgroundColor: `color-mix(in srgb, ${explicitColor} 18%, transparent)`,
      color: explicitColor,
      borderColor: `color-mix(in srgb, ${explicitColor} 42%, transparent)`,
    };
  }

  const index = options.indexOf(value);
  const total = options.length || 1;
  const position = index === -1 ? 0 : index;

  const hue = Math.round((position / total) * 360);

  return {
    backgroundColor: `hsla(${hue}, 70%, 60%, 0.15)`,
    color: `hsl(${hue}, 70%, 70%)`,
    borderColor: "transparent",
  };
}
