import { cn } from "@/lib/utils";
import {
  ArrowsClockwiseIcon,
  ClipboardTextIcon,
  EnvelopeSimpleIcon,
  HardDrivesIcon,
  LinkIcon,
  LockKeyIcon,
  QueueIcon,
  UserPlusIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";

export default function FeaturesSection() {
  const features = [
    {
      title: "Follow gate",
      description:
        "Optionally require a follow before handing over the link. Re-prompts until they do.",
      icon: <UserPlusIcon weight="duotone" className="size-5" />,
    },
    {
      title: "Fully self-hosted",
      description: "No plan limits, no seat caps. You run it, you own it.",
      icon: <HardDrivesIcon weight="duotone" className="size-5" />,
    },
    {
      title: "Email magic-link sign-in",
      description: "No passwords. One tap from your email.",
      icon: <EnvelopeSimpleIcon weight="duotone" className="size-5" />,
    },
    {
      title: "Tracked links with click stats",
      description:
        "Swap any link for a tracked redirect. See clicks and CTR per campaign.",
      icon: <LinkIcon weight="duotone" className="size-5" />,
    },
    {
      title: "Multiple Instagram accounts",
      description: "Connect several professional accounts under one workspace.",
      icon: <UsersThreeIcon weight="duotone" className="size-5" />,
    },
    {
      title: "Encrypted tokens at rest",
      description: "AES-256-GCM encryption. Your tokens never touch plaintext.",
      icon: <LockKeyIcon weight="duotone" className="size-5" />,
    },
    {
      title: "Webhook + polling reconciliation",
      description:
        "Live webhooks plus a polling safety net. Nothing slips through.",
      icon: <ArrowsClockwiseIcon weight="duotone" className="size-5" />,
    },
    {
      title: "Queue-backed delivery",
      description:
        "BullMQ handles retries, rate limits, and overflow automatically.",
      icon: <QueueIcon weight="duotone" className="size-5" />,
    },
    {
      title: "DM logs with full status",
      description: "Every send, skip, and failure is logged with a reason.",
      icon: <ClipboardTextIcon weight="duotone" className="size-5" />,
    },
  ];
  return (
    <section id="features">
      <div className="mx-auto w-full max-w-8xl px-5 py-24 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            What&rsquo;s included
          </p>
          <h2 className="mt-4 text-4xl font-bold leading-tight tracking-tighter text-foreground sm:text-5xl">
            Everything,
            <br />
            no tiers
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            Self-hosted and open source. Nothing to unlock. You run it, you own
            it.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 relative z-10 max-w-8xl mx-auto overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
          {features.map((feature, index) => (
            <Feature key={feature.title} {...feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

const Feature = ({
  title,
  description,
  icon,
  index,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
}) => {
  return (
    <div
      className={cn(
        "flex flex-col py-10 relative group/feature bg-background",
        "border-b border-border last:border-b-0 lg:border-b-0",
        index % 3 !== 2 && "lg:border-r",
        index < 6 && "lg:border-b",
      )}
    >
      {index < 6 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-300 absolute inset-0 h-full w-full bg-linear-to-t from-muted/50 to-transparent pointer-events-none" />
      )}
      {index >= 6 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-300 absolute inset-0 h-full w-full bg-linear-to-b from-muted/50 to-transparent pointer-events-none" />
      )}
      <div className="mb-4 relative z-10 px-8">
        <span className="inline-flex size-10 items-center justify-center rounded-xl gradient-glow [--glow-color:#b3e700] text-black">
          {icon}
        </span>
      </div>
      <div className="text-[15px] font-bold mb-2 relative z-10 px-8">
        <div className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full bg-border group-hover/feature:bg-primary transition-all duration-300 origin-center" />
        <span className="group-hover/feature:translate-x-1 transition duration-300 inline-block text-foreground">
          {title}
        </span>
      </div>
      <p className="text-sm leading-6 text-muted-foreground max-w-xs relative z-10 px-8">
        {description}
      </p>
    </div>
  );
};
