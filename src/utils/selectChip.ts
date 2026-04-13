export function getChipStyle(
  value: string,
  options: string[],
): Record<string, string> {
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
