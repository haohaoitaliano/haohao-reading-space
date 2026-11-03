import Image from "next/image";
import type { CSSProperties } from "react";

type BrandMarkProps = {
  size?: number;
  style?: CSSProperties;
};

export function BrandMark({ size = 40, style }: BrandMarkProps) {
  return (
    <Image
      alt="好好意语"
      className="brand-mark"
      height={size}
      src="/icons/icon-192.png"
      style={{ width: size, height: size, objectFit: "contain", ...style }}
      unoptimized
      width={size}
    />
  );
}
