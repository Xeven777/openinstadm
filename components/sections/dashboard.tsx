import Image from "next/image";
import React from "react";
import { SectionHeading } from "@/components/ui/section-heading";
import dashboardImage from "@/assets/dashboard.webp";

const Dashboard = () => {
  return (
    <section className="border-y border-border">
      <div className="mx-auto grid w-full max-w-8xl gap-12 px-5 py-24 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:items-center">
        <div>
          <Image
            src={dashboardImage}
            alt="dashboard"
            width={800}
            height={600}
            className="rounded-lg border border-border object-cover"
          />
        </div>

        <div>
          <SectionHeading
            align="left"
            eyebrow="The dashboard"
            title="See exactly what"
            accent="happened"
            description="Every comment event is traceable: queued, matched, sent, skipped, failed, or rate-limited. No black box."
          />
          <div className="mt-8 flex flex-col gap-3">
            {[
              "Real-time activity feed",
              "Per-campaign click tracking",
              "Full DM logs with reasons",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  ✓
                </span>
                <span className="text-sm font-medium text-foreground">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
