"use client";
import React from "react";
import { AgentInbox } from "@/components/agent-inbox";

export default function DemoPage(): React.ReactNode {
  return (
    <div className="flex flex-col w-full h-full relative">
      <AgentInbox />
    </div>
  );
}
