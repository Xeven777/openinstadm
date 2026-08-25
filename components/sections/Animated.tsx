"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle,
  Heart,
  InstagramLogo,
  Lightning,
  ChatCircleDots,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

type Stage = "comment" | "detecting" | "dm" | "thanks" | "followup";

const EASE = [0.22, 1, 0.36, 1] as const;

const TIMINGS = {
  comment: 3600,
  detecting: 1900,
  dm: 3600,
  thanks: 2000,
  followup: 3400,
};

export default function OpenInstaDMHeroAnimation() {
  const [stage, setStage] = useState<Stage>("comment");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timeoutRef.current = setTimeout(resolve, ms);
      });

    const sequence = async () => {
      while (!cancelled) {
        setStage("comment");
        await wait(TIMINGS.comment);

        if (cancelled) break;

        setStage("detecting");
        await wait(TIMINGS.detecting);

        if (cancelled) break;

        setStage("dm");
        await wait(TIMINGS.dm);

        if (cancelled) break;

        setStage("thanks");
        await wait(TIMINGS.thanks);

        if (cancelled) break;

        setStage("followup");
        await wait(TIMINGS.followup);
      }
    };

    sequence();

    return () => {
      cancelled = true;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 20,
        scale: 0.97,
      }}
      animate={{
        opacity: 1,
        y: [0, -4, 0],
        scale: 1,
      }}
      transition={{
        opacity: {
          duration: 1,
          ease: EASE,
        },
        scale: {
          duration: 1,
          ease: EASE,
        },
        y: {
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        },
      }}
      className="relative w-[310px] sm:w-[330px]"
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -inset-14 -z-10 rounded-full bg-white/35 blur-3xl dark:bg-lime-400/10 dark:blur-3xl" />

      <motion.div
        layout
        transition={{
          layout: {
            duration: 1.0,
            ease: EASE,
          },
        }}
        className="
          overflow-hidden
          rounded-[22px]
          border border-white/80
          bg-white/[0.94]
          shadow-[0_25px_90px_rgba(0,0,0,0.14)]
          backdrop-blur-2xl
          dark:border-white/10
          dark:bg-zinc-900/85
          dark:shadow-[0_25px_90px_rgba(0,0,0,0.55),0_0_80px_rgba(132,204,22,0.06)]
        "
      >
        <AnimatePresence mode="wait" initial={false}>
          {stage === "comment" && <CommentView key="comment" />}
          {stage === "detecting" && <DetectingView key="detecting" />}
          {stage === "dm" && <DMView key="dm" />}
          {stage === "thanks" && <ThanksView key="thanks" />}
          {stage === "followup" && <FollowUpView key="followup" />}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* COMMENT                                                                    */
/* -------------------------------------------------------------------------- */

function CommentView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: -8,
        scale: 0.985,
      }}
      transition={{
        duration: 0.7,
        ease: EASE,
      }}
      className="p-3"
    >
      <div className="overflow-hidden rounded-[16px] border border-neutral-200/80 bg-white">
        {/* Instagram header */}
        <div className="flex items-center gap-2.5 px-3.5 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#FCAF45]">
            <InstagramLogo size={17} weight="fill" className="text-white" />
          </div>

          <div className="flex-1">
            <p className="text-[11px] font-semibold text-neutral-900">
              ImanG
            </p>

            <p className="text-[9px] text-neutral-400">2h</p>
          </div>

          <span className="text-[11px] tracking-[3px] text-neutral-300">
            •••
          </span>
        </div>

        {/* Post */}
        <div className="relative h-50 overflow-hidden bg-gradient-to-br from-lime-100 via-green-100 to-sky-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://i.ytimg.com/vi/FrPT_I71A7Y/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLCTOL87Ik30DDSx5lx5wAzaQcyGrw"
            alt=""
            loading="lazy"
            decoding="async"
            width={400}
            className="object-cover size-full"
          />
        </div>

        {/* Post actions */}
        <div className="flex items-center gap-3 px-3.5 py-2.5">
          <Heart size={16} weight="regular" className="text-neutral-800" />

          <ChatCircleDots
            size={16}
            weight="regular"
            className="text-neutral-800"
          />

          <PaperPlaneTilt
            size={16}
            weight="regular"
            className="text-neutral-800"
          />

          <span className="ml-auto text-[10px] text-neutral-400">
            128 likes
          </span>
        </div>

        {/* Caption */}
        <div className="px-3.5 pb-2">
          <p className="text-[10px] leading-4 text-neutral-600">
            New guide is finally here.
          </p>

          <p className="mt-0.5 text-[9px] text-neutral-400">
            View all 24 comments
          </p>
        </div>

        {/* Trigger comment */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.5,
            duration: 0.7,
            ease: EASE,
          }}
          className="mx-3.5 mb-3.5 rounded-[12px] bg-neutral-50 px-3 py-2.5"
        >
          <div className="flex gap-2.5">
            <div className="mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-neutral-200">
              <div className="flex h-full w-full items-center justify-center text-[8px] font-semibold text-neutral-500">
                J
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] leading-4 text-neutral-800">
                <span className="font-semibold">jordan</span> Send Link 👇
              </p>

              <div className="mt-1 flex items-center gap-2">
                <span className="text-[8px] text-neutral-400">1m</span>

                <span className="text-[8px] font-medium text-neutral-400">
                  Reply
                </span>
              </div>
            </div>

            <Heart
              size={12}
              weight="regular"
              className="mt-1 text-neutral-300"
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* DETECTING                                                                  */
/* -------------------------------------------------------------------------- */

function DetectingView() {
  return (
    <motion.div
      initial={{
        opacity: 0,
        scale: 0.985,
      }}
      animate={{
        opacity: 1,
        scale: 1,
      }}
      exit={{
        opacity: 0,
        scale: 0.985,
      }}
      transition={{
        duration: 0.7,
        ease: EASE,
      }}
      className="relative flex min-h-[235px] items-center justify-center overflow-hidden px-8 py-10"
    >
      {/* Soft background pulse */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.18, 0.35, 0.18],
        }}
        transition={{
          duration: 2.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="
          pointer-events-none
          absolute
          h-32
          w-32
          rounded-full
          bg-lime-300
          blur-3xl
        "
      />

      <div className="relative z-10 text-center">
        {/* Icon */}
        <div className="relative mx-auto flex h-14 w-14 items-center justify-center">
          <motion.div
            animate={{
              scale: [1, 1.14, 1],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="
              absolute
              inset-0
              rounded-full
              bg-lime-100
            "
          />

          <motion.div
            animate={{
              rotate: [0, 4, -4, 0],
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="
              relative
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-full
              bg-lime-200
            "
          >
            <Lightning size={20} weight="fill" className="text-lime-800" />
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.25,
            duration: 0.55,
            ease: EASE,
          }}
          className="mt-5 text-[12px] font-semibold text-neutral-900"
        >
          Automation triggered
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.4,
            duration: 0.55,
            ease: EASE,
          }}
          className="mt-1.5 text-[10px] leading-4 text-neutral-400"
        >
          Comment detected.
          <br />
          Preparing your DM...
        </motion.p>

        {/* Progress indicator */}
        <div className="mx-auto mt-5 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{
                opacity: [0.25, 1, 0.25],
                scale: [0.9, 1, 0.9],
              }}
              transition={{
                duration: 1.1,
                delay: i * 0.18,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="h-1.5 w-1.5 rounded-full bg-lime-500"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* AUTOMATED DM                                                               */
/* -------------------------------------------------------------------------- */

function DMView() {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 14,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        y: -8,
        scale: 0.985,
      }}
      transition={{
        duration: 0.8,
        ease: EASE,
      }}
      className="p-4"
    >
      {/* DM header */}
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#FCAF45]">
          <InstagramLogo size={18} weight="fill" className="text-white" />
        </div>

        <div className="flex-1">
          <p className="text-[12px] font-semibold text-neutral-900">Messages</p>

          <p className="text-[9px] text-neutral-400">ImanG</p>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-lime-500" />

          <span className="text-[9px] font-medium text-neutral-400">
            active
          </span>
        </div>
      </div>

      {/* Automated response only */}
      <motion.div
        initial={{
          opacity: 0,
          y: 10,
          x: 8,
        }}
        animate={{
          opacity: 1,
          y: 0,
          x: 0,
        }}
        transition={{
          delay: 0.25,
          duration: 0.75,
          ease: EASE,
        }}
        className="flex justify-end"
      >
        <div className="max-w-[88%] rounded-[16px] rounded-br-[5px] bg-neutral-950 px-3.5 py-3 text-white">
          <p className="text-[11px] leading-[1.5]">
            Hey 👋 Here’s your special link.
          </p>

          <motion.div
            initial={{
              opacity: 0,
              y: 8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.65,
              duration: 0.7,
              ease: EASE,
            }}
            className="
              mt-2.5
              flex
              h-9
              items-center
              justify-center
              gap-1.5
              rounded-[10px]
              bg-white/15
              px-3
              text-[9px]
              font-semibold
              backdrop-blur
            "
          >
            Grab Your Guide
            <ArrowUpRight size={11} weight="bold" />
          </motion.div>
        </div>
      </motion.div>

      {/* Delivery status */}
      <motion.div
        initial={{
          opacity: 0,
          y: 4,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          delay: 1.4,
          duration: 0.55,
          ease: EASE,
        }}
        className="mt-3 flex items-center justify-end gap-1.5 px-1"
      >
        <CheckCircle size={11} weight="fill" className="text-lime-600" />

        <span className="text-[8px] font-medium text-neutral-400">
          Sent automatically
        </span>
      </motion.div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* THANK YOU                                                                  */
/* -------------------------------------------------------------------------- */

function ThanksView() {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 14,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        y: -8,
        scale: 0.985,
      }}
      transition={{
        duration: 0.8,
        ease: EASE,
      }}
      className="p-4"
    >
      <ChatHeader />

      <div className="space-y-2.5">
        {/* Previous automated DM */}
        <div className="flex justify-end">
          <div className="max-w-[82%] rounded-[15px] rounded-br-[5px] bg-neutral-950 px-3.5 py-3 text-white">
            <p className="text-[11px]">Here’s your special link 👇</p>

            <div className="mt-2 flex h-8 items-center justify-center rounded-[9px] bg-white/15 text-[9px] font-semibold">
              Grab Your Guide
            </div>
          </div>
        </div>

        {/* Customer reply */}
        <motion.div
          initial={{
            opacity: 0,
            x: -10,
            scale: 0.97,
          }}
          animate={{
            opacity: 1,
            x: 0,
            scale: 1,
          }}
          transition={{
            delay: 0.45,
            duration: 0.8,
            ease: EASE,
          }}
          className="flex items-end gap-2"
        >
          <Avatar />

          <div className="rounded-[15px] rounded-bl-[5px] bg-neutral-100 px-3.5 py-2.5">
            <p className="text-[11px] font-medium text-neutral-700">
              Thank you! 🙌
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* FOLLOW-UP                                                                  */
/* -------------------------------------------------------------------------- */

function FollowUpView() {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 14,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        y: -10,
        scale: 0.985,
      }}
      transition={{
        duration: 0.8,
        ease: EASE,
      }}
      className="p-4"
    >
      <ChatHeader />

      <div className="space-y-2.5">
        {/* Thank you */}
        <div className="flex items-end gap-2">
          <Avatar />

          <div className="rounded-[15px] rounded-bl-[5px] bg-neutral-100 px-3.5 py-2.5">
            <p className="text-[11px] font-medium text-neutral-700">
              Thank you! 🙌
            </p>
          </div>
        </div>

        {/* Follow-up */}
        <motion.div
          initial={{
            opacity: 0,
            x: 10,
            scale: 0.97,
          }}
          animate={{
            opacity: 1,
            x: 0,
            scale: 1,
          }}
          transition={{
            delay: 0.45,
            duration: 0.85,
            ease: EASE,
          }}
          className="flex justify-end"
        >
          <div className="max-w-[88%] rounded-[16px] rounded-br-[5px] bg-neutral-950 px-3.5 py-3 text-white">
            <p className="text-[11px] leading-[1.5]">
              Want the full 7-day guide too? 👀
            </p>

            <motion.div
              initial={{
                opacity: 0,
                y: 7,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: 0.9,
                duration: 0.65,
                ease: EASE,
              }}
              className="
                mt-2.5
                flex
                h-9
                items-center
                justify-center
                gap-1.5
                rounded-[10px]
                bg-lime-400
                px-3
                text-[9px]
                font-bold
                text-neutral-950
              "
            >
              Get the 7-Day Guide
              <ArrowUpRight size={11} weight="bold" />
            </motion.div>
          </div>
        </motion.div>

        {/* Automation label */}
        <motion.div
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 1.45,
            duration: 0.6,
          }}
          className="flex justify-end px-1"
        >
          <div className="flex items-center gap-1.5">
            <Lightning size={10} weight="fill" className="text-lime-600" />

            <span className="text-[8px] font-medium text-neutral-400">
              Automated follow-up
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* SHARED COMPONENTS                                                          */
/* -------------------------------------------------------------------------- */

function ChatHeader() {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#FCAF45]">
        <InstagramLogo size={18} weight="fill" className="text-white" />
      </div>

      <div className="flex-1">
        <p className="text-[12px] font-semibold text-neutral-900">Messages</p>

        <p className="text-[9px] text-neutral-400">ImanG</p>
      </div>

      <span className="h-1.5 w-1.5 rounded-full bg-lime-500" />
    </div>
  );
}

function Avatar() {
  return (
    <div className="h-6 w-6 flex-shrink-0 rounded-full bg-neutral-200">
      <div className="flex h-full w-full items-center justify-center text-[7px] font-semibold text-neutral-500">
        J
      </div>
    </div>
  );
}
