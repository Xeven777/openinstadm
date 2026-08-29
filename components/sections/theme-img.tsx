"use client";

import Image from "next/image";
import bg from "@/assets/bg.webp";
import bgn from "@/assets/bg-n.webp";
import { useTheme } from "next-themes";

const ThemeImg = () => {
  const { resolvedTheme } = useTheme();

  return (
    <div className="absolute inset-0">
      <Image
        src={resolvedTheme === "dark" ? bgn : bg}
        alt="background"
        aria-hidden="true"
        className="size-full object-cover object-[65%_40%] sm:object-[55%_35%] lg:object-center hidden md:block"
        loading="eager"
        decoding="async"
        width={1400}
        height={800}
      />
    </div>
  );
};

export default ThemeImg;
