import { useState } from "react";

/**
 * Avatar
 *
 * @prop {string}  name      used to derive initials and aria-label
 * @prop {string}  photoUrl  if present, renders the image (falls back to initials on error)
 * @prop {number}  size      pixel size (default: 36)
 * @prop {string}  shape     "square" | "circle" (default: "square")
 * @prop {string}  className
 */
export default function Avatar({
  name = "",
  photoUrl,
  size = 36,
  shape = "square",
  className = "",
}) {
  const [imgError, setImgError] = useState(false);

  const initials = name
    .split(" ")
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  const borderRadius =
    shape === "circle"
      ? "50%"
      : `${Math.max(4, Math.round(size * 0.28))}px`;

  const fontSize = Math.max(10, Math.round(size * 0.36));

  const base = {
    width: size,
    height: size,
    borderRadius,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={name || "avatar"}
        style={{ ...base, objectFit: "cover" }}
        className={`yd-avatar ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`yd-avatar ${className}`}
      style={{ ...base, fontSize, fontWeight: 800, letterSpacing: "-0.02em" }}
      aria-label={name}
      title={name}
    >
      {initials}
    </div>
  );
}
