"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";
import { dmSerif } from "@/lib/fonts";

type Align = "center" | "left";

type SectionHeadingProps = {
  /** Small eyebrow above the heading — renders with pricing's muted style */
  eyebrow?: string;
  /** Main heading first line(s). Keep short — e.g. "Transparent pricing," */
  title: React.ReactNode;
  /** Optional second line rendered in italic DM Serif with gradient — e.g. "no hidden fees." */
  accent?: React.ReactNode;
  /** Optional paragraph below the heading */
  description?: React.ReactNode;
  /** Layout alignment — "center" matches pricing, "left" matches features/dashboard/faq */
  align?: Align;
  /** Additional classes for the outer wrapper */
  className?: string;
  /** Override eyebrow classes */
  eyebrowClassName?: string;
  /** Override heading classes */
  headingClassName?: string;
  /** Override description classes */
  descriptionClassName?: string;
  /** Heading element — defaults to h2 */
  as?: "h1" | "h2" | "h3";
};

const EASE = [0.16, 1, 0.3, 1] as const;

const MotionH1 = motion.create("h1");
const MotionH2 = motion.create("h2");
const MotionH3 = motion.create("h3");

const wordVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

const fadeVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/** Slight word-by-word fade. Non-string nodes fade as a single unit. */
function Words({ text }: { text: React.ReactNode }) {
  if (typeof text !== "string") {
    return (
      <motion.span variants={fadeVariants} className="inline-block">
        {text}
      </motion.span>
    );
  }
  return (
    <>
      {text.split(" ").map((word, i, arr) => (
        <motion.span key={`${word}-${i}`} variants={wordVariants} className="inline-block">
          {word}
          {i < arr.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </>
  );
}

function StaticHeading({
  eyebrow,
  title,
  accent,
  description,
  align,
  className,
  eyebrowClassName,
  headingClassName,
  descriptionClassName,
  as: Tag,
}: SectionHeadingProps & { align: Align; as: "h1" | "h2" | "h3" }) {
  return (
    <div className={cn(align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl", className)}>
      {eyebrow ? (
        <p
          className={cn(
            "text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground",
            eyebrowClassName,
          )}
        >
          {eyebrow}
        </p>
      ) : null}

      <Tag
        className={cn(
          "mt-4 text-balance text-4xl font-semibold leading-[1.05] tracking-[-6%] text-foreground sm:text-5xl lg:text-6xl",
          headingClassName,
        )}
      >
        {title}
        {accent ? (
          <>
            <br />
            <span
              className={cn(
                "italic tracking-normal bg-clip-text text-transparent bg-linear-to-r from-primary to-foreground",
                dmSerif.className,
              )}
            >
              {accent}
            </span>
          </>
        ) : null}
      </Tag>

      {description ? (
        <p
          className={cn(
            "text-pretty leading-relaxed text-muted-foreground",
            align === "center"
              ? "mx-auto mt-4 max-w-2xl text-sm sm:text-base"
              : "mt-6 max-w-md text-base",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  accent,
  description,
  align = "center",
  className,
  eyebrowClassName,
  headingClassName,
  descriptionClassName,
  as: Tag = "h2",
}: SectionHeadingProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <StaticHeading
        eyebrow={eyebrow}
        title={title}
        accent={accent}
        description={description}
        align={align}
        className={className}
        eyebrowClassName={eyebrowClassName}
        headingClassName={headingClassName}
        descriptionClassName={descriptionClassName}
        as={Tag}
      />
    );
  }

  const MotionTag = Tag === "h1" ? MotionH1 : Tag === "h3" ? MotionH3 : MotionH2;

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
      }}
      className={cn(align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl", className)}
    >
      {eyebrow ? (
        <motion.p
          variants={fadeVariants}
          className={cn(
            "text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground",
            eyebrowClassName,
          )}
        >
          {eyebrow}
        </motion.p>
      ) : null}

      <MotionTag
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.035 } },
        }}
        className={cn(
          "mt-4 text-balance text-4xl font-semibold leading-[1.05] tracking-[-6%] text-foreground sm:text-5xl lg:text-6xl",
          headingClassName,
        )}
      >
        <Words text={title} />
        {accent ? (
          <>
            <br />
            <span
              className={cn(
                "italic tracking-normal bg-clip-text text-transparent bg-linear-to-r from-primary to-foreground",
                dmSerif.className,
              )}
            >
              <Words text={accent} />
            </span>
          </>
        ) : null}
      </MotionTag>

      {description ? (
        <motion.p
          variants={fadeVariants}
          className={cn(
            "text-pretty leading-relaxed text-muted-foreground",
            align === "center"
              ? "mx-auto mt-4 max-w-2xl text-sm sm:text-base"
              : "mt-6 max-w-md text-base",
            descriptionClassName,
          )}
        >
          {description}
        </motion.p>
      ) : null}
    </motion.div>
  );
}

export default SectionHeading;
