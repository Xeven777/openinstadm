"use client"

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
  useMemo,
} from "react";
import {
  motion,
  AnimatePresence,
  Variants,
  useReducedMotion,
  useInView,
} from "motion/react";
import Image from "next/image";

// ============================================================================
// Types & Enums
// ============================================================================

export enum ChatStep {
  COMMENT = "COMMENT",
  BOT_EBOOK = "BOT_EBOOK",
  USER_QUESTION = "USER_QUESTION",
  BOT_PRODUCT = "BOT_PRODUCT",
  RESET = "RESET",
}

export const TIMELINE_MS = {
  COMMENT_TO_EBOOK: 2200,
  EBOOK_TO_USER_QUESTION: 4800,
  USER_QUESTION_TO_PRODUCT: 7600,
  PRODUCT_TO_RESET: 11000,
  TOTAL_LOOP_CYCLE: 12000,
} as const;

export interface AnimatedTextProps {
  text: string;
  className?: string;
  delay?: number;
}

export interface BotBubbleProps {
  layoutId?: string;
  message: string;
  ctaText: string;
  ctaDelay?: number;
}

// ============================================================================
// Framer Motion Variants — defined outside component to avoid recreation
// ============================================================================

const textContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: delay },
  }),
};

const textWordVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
    filter: "blur(4px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      damping: 20,
      stiffness: 150,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 35, scale: 0.92 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    y: -30,
    scale: 0.9,
    filter: "blur(8px)",
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

// ============================================================================
// Sub-Components — memoized to reduce parent step rerenders
// ============================================================================

export const AnimatedText: React.FC<AnimatedTextProps> = memo(
  ({ text, className = "", delay = 0 }) => {
    const words = useMemo(() => text.split(" "), [text]);

    return (
      <motion.span
        className={`inline-block ${className}`}
        variants={textContainerVariants}
        initial="hidden"
        animate="visible"
        custom={delay}
      >
        {words.map((word, index) => (
          <motion.span
            key={`${word}-${index}`}
            variants={textWordVariants}
            className="inline-block mr-[0.25em]"
          >
            {word}
          </motion.span>
        ))}
      </motion.span>
    );
  },
);
AnimatedText.displayName = "AnimatedText";

export const BotBubble: React.FC<BotBubbleProps> = memo(
  ({ layoutId, message, ctaText, ctaDelay = 0.4 }) => {
    return (
      <motion.div
        layoutId={layoutId}
        layout
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="self-end max-w-[85%] bg-linear-to-br from-purple-600 via-indigo-600 to-purple-700 text-white rounded-3xl rounded-br-md p-4 shadow-xl border border-purple-400/20"
      >
        <p className="text-[15px] font-medium leading-snug mb-3">
          <AnimatedText text={message} />
        </p>
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ctaDelay, duration: 0.5 }}
          className="w-full py-2.5 px-4 bg-white/20 hover:bg-white/30 active:scale-98 rounded-2xl text-sm font-semibold transition-all border border-white/20 shadow-md flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
        >
          <span>{ctaText}</span>
          <svg
            className="w-4 h-4 fill-current"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
          </svg>
        </motion.button>
      </motion.div>
    );
  },
);
BotBubble.displayName = "BotBubble";

const UserBubble = memo(function UserBubble({
  text,
}: {
  text: string;
}) {
  return (
    <motion.div
      layout
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="self-start max-w-[82%] flex items-end gap-2.5"
    >
      <Image
        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
        alt=""
        aria-hidden="true"
        width={28}
        height={28}
        loading="lazy"
        className="w-7 h-7 rounded-full object-cover border mb-1"
      />
      <div className="bg-muted border text-foreground rounded-3xl rounded-bl-md py-3 px-4 shadow-lg">
        <p className="text-[14px] font-normal leading-relaxed">
          <AnimatedText text={text} />
        </p>
      </div>
    </motion.div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export default function InteractiveChatMorph() {
  const [step, setStep] = useState<ChatStep>(ChatStep.COMMENT);
  const shouldReduceMotion = useReducedMotion();

  // viewport-aware: pause timeline when off-screen
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, {
    amount: 0.25,
    margin: "0px 0px 0px 0px",
  });

  // Typed refs for timer management to prevent memory/state leaks
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = useCallback(() => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const runTimeline = useCallback(() => {
    // Clear stale timers before starting a new pass
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];

    setStep(ChatStep.COMMENT);

    timeoutsRef.current.push(
      setTimeout(
        () => setStep(ChatStep.BOT_EBOOK),
        TIMELINE_MS.COMMENT_TO_EBOOK,
      ),
    );

    timeoutsRef.current.push(
      setTimeout(
        () => setStep(ChatStep.USER_QUESTION),
        TIMELINE_MS.EBOOK_TO_USER_QUESTION,
      ),
    );

    timeoutsRef.current.push(
      setTimeout(
        () => setStep(ChatStep.BOT_PRODUCT),
        TIMELINE_MS.USER_QUESTION_TO_PRODUCT,
      ),
    );

    timeoutsRef.current.push(
      setTimeout(() => setStep(ChatStep.RESET), TIMELINE_MS.PRODUCT_TO_RESET),
    );
  }, []);

  useEffect(() => {
    // Static accessible view for users with prefers-reduced-motion active
    if (shouldReduceMotion) return;

    // Pause when off-screen — saves CPU/GPU and avoids background work
    if (!isInView) {
      clearAllTimers();
      return;
    }

    const startLoop = () => {
      runTimeline();
      intervalRef.current = setInterval(
        runTimeline,
        TIMELINE_MS.TOTAL_LOOP_CYCLE,
      );
    };

    const handleVisibilityChange = () => {
      if (document.hidden || !isInView) {
        clearAllTimers();
      } else {
        // restart fresh when tab becomes visible again
        clearAllTimers();
        startLoop();
      }
    };

    if (!document.hidden) {
      startLoop();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearAllTimers();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [runTimeline, clearAllTimers, shouldReduceMotion, isInView]);

  // Reduced motion accessible fallback — no timers, no motion
  if (shouldReduceMotion) {
    return (
      <div className="flex items-center justify-center text-foreground">
        <div
          className="w-full max-w-sm space-y-4"
          role="log"
          aria-live="polite"
        >
          <BotBubble
            message="Hey 👋 Here's that ebook you requested!"
            ctaText="Grab Your Guide"
          />
          <div className="self-start max-w-[82%] flex items-end gap-2.5">
            <Image
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
              alt=""
              aria-hidden="true"
              width={28}
              height={28}
              loading="lazy"
              className="w-7 h-7 rounded-full object-cover border mb-1"
            />
            <div className="bg-muted border text-foreground rounded-3xl rounded-bl-md py-3 px-4 shadow-lg">
              <p className="text-[14px]">
                Do you have a website where I can see more?
              </p>
            </div>
          </div>
          <BotBubble
            message="Check out our main product showcase!"
            ctaText="Let's Go!"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center"
    >
      <div
        className="w-full max-w-sm min-h-76 flex flex-col justify-end relative z-10"
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence mode="popLayout">
          {/* STEP 1: SOCIAL COMMENT UI */}
          {step === ChatStep.COMMENT && (
            <motion.div
              key="comment-box"
              layoutId="shared-card-container"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-card border p-4 rounded-3xl shadow-2xl flex items-center gap-3.5"
            >
              <Image
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                alt=""
                aria-hidden="true"
                width={40}
                height={40}
                loading="lazy"
                className="w-10 h-10 rounded-full object-cover border"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    @alex_design
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">Just now</span>
                </div>
                <div className="text-sm font-medium text-card-foreground flex items-center gap-1.5">
                  <AnimatedText text="Send Link 🚀" />
                </div>
              </div>
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: "spring" }}
                className="px-2.5 py-1 bg-lime-900 text-primary border border-primary/20 rounded-full text-xs font-medium"
              >
                Triggered
              </motion.span>
            </motion.div>
          )}

          {/* CHAT MESSAGES STACK */}
          {step !== ChatStep.COMMENT && step !== ChatStep.RESET && (
            <div className="flex flex-col space-y-3.5">
              {/* BOT EBOOK CARD (Morphs smoothly from comment box) */}
              {(step === ChatStep.BOT_EBOOK ||
                step === ChatStep.USER_QUESTION) && (
                <BotBubble
                  key="msg-bot-ebook"
                  layoutId={
                    step === ChatStep.BOT_EBOOK
                      ? "shared-card-container"
                      : undefined
                  }
                  message="Hey 👋 Here's that ebook you requested!"
                  ctaText="Grab Your Guide"
                  ctaDelay={0.5}
                />
              )}

              {/* USER QUESTION BUBBLE */}
              {(step === ChatStep.USER_QUESTION ||
                step === ChatStep.BOT_PRODUCT) && (
                <UserBubble
                  key="msg-user-question"
                  text="Do you have a website where I can see more?"
                />
              )}

              {/* BOT PRODUCT CTA CARD */}
              {step === ChatStep.BOT_PRODUCT && (
                <BotBubble
                  key="msg-bot-product"
                  message="Check out our main product showcase!"
                  ctaText="Let's Go!"
                  ctaDelay={0.4}
                />
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
