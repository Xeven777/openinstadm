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
  return (
    <div
      className={cn(
        align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl",
        className,
      )}
    >
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

export default SectionHeading;
