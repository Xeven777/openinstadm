import { SpinnerBallIcon } from "@phosphor-icons/react/dist/ssr";
import React from "react";

const loading = () => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SpinnerBallIcon size={32} className="animate-spin text-primary" />
    </div>
  );
};

export default loading;
