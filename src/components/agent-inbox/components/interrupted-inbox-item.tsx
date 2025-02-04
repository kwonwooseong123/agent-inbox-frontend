import { cn } from "@/lib/utils";
import { HumanInterrupt } from "../types";
import React, { useState, useEffect } from "react";
import { InboxItemStatuses } from "./statuses";
import { Thread } from "@langchain/langgraph-sdk";
import { format } from "date-fns";
import { useQueryParams } from "../hooks/use-query-params";
import { VIEW_STATE_THREAD_QUERY_PARAM } from "../constants";
import { DeleteButton } from "@/components/ui/deleteItem";
import { Button } from "@/components/ui/button";
import NextLink from "next/link";
import { constructOpenInStudioURL } from "../utils";
import { useThreadsContext } from "../contexts/ThreadContext";


interface InterruptedInboxItem<
  ThreadValues extends Record<string, any> = Record<string, any>,
> {
  threadData: {
    thread: Thread<ThreadValues>;
    status: "interrupted";
    interrupts: HumanInterrupt[];
  };
  isLast: boolean;
}

export function InterruptedInboxItem<
  ThreadValues extends Record<string, any> = Record<string, any>,
>({ threadData, isLast }: InterruptedInboxItem<ThreadValues>) {
  const { updateQueryParams } = useQueryParams();
  const itemId = threadData.thread.thread_id; // Use thread ID as item ID
  const [isWatched, setIsWatched] = useState(() => {
    return localStorage.getItem(`watched-${itemId}`) === "true";
  });

  useEffect(() => {
    localStorage.setItem(`watched-${itemId}`, JSON.stringify(isWatched));
  }, [isWatched, itemId]);

  const descriptionPreview =
    threadData.interrupts[0].description &&
    threadData.interrupts[0].description.slice(0, 65);
  const descriptionTruncated =
    threadData.interrupts[0].description &&
    threadData.interrupts[0].description.length > 65;

  const updatedAtDateString = format(
    new Date(threadData.thread.updated_at),
    "MM/dd h:mm a"
  );

  const { agentInboxes } = useThreadsContext<ThreadValues>();
  const deploymentUrl = agentInboxes.find((i) => i.selected)?.deploymentUrl;
  const handleOpenInStudio = () => {
    if (deploymentUrl) {
      window.open(
        constructOpenInStudioURL(deploymentUrl, threadData.thread.thread_id),
        "_blank"
      );
    } else {
      console.error("Deployment URL is undefined");
    }
  };

  const handleWatch = () => {
    setIsWatched(prev => !prev); // Toggle watched state
  };
  return (
    <div
      onClick={() => {
        updateQueryParams(
          VIEW_STATE_THREAD_QUERY_PARAM,
          itemId
        );
        handleWatch(); // Toggle watched state on click
      }}
      className={cn(
        "grid grid-cols-12 w-full p-7 items-center cursor-pointer hover:bg-gray-50/90 dark:hover:bg-gray-800 transition-colors ease-in-out",
        !isLast && "border-b-[1px] border-gray-200 dark:border-gray-800",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-start gap-2",
          deploymentUrl ? "col-span-7" : "col-span-9"
        )}
      >
        {/* Conditional rendering of the dot */}
        {isWatched ? (
          <div className="w-[6px] h-[6px] rounded-full color = null" /> // Dot is gray when watched
        ) : (
          <div className="w-[6px] h-[6px] rounded-full bg-green-400" /> // Dot is green when unwatched
        )}
        <div className="flex items-center justify-start gap-4">
          <p className="text-black dark:text-white text-sm font-semibold">
            {threadData.interrupts[0].action_request.action || "Unknown"}
          </p>
          {descriptionPreview && (
            <p className="text-sm text-black dark:text-gray-200 font-light">{`${descriptionPreview}${descriptionTruncated ? "..." : ""}`}</p>
          )}
        </div>
      </div>
      {deploymentUrl && (
        <div className="col-span-2">
          <NextLink
            href={constructOpenInStudioURL(
              deploymentUrl,
              threadData.thread.thread_id
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-1 bg-white dark:bg-gray-800"
              onClick={(event) => {
                event.stopPropagation(); // Prevent the click from bubbling up
                handleOpenInStudio(); // Call the function to open the studio
              }}
            >
              Studio
            </Button>
          </NextLink>
        </div>
      )}
      <DeleteButton threadId={threadData.thread.thread_id} />
      <div className="col-span-2">
        <InboxItemStatuses config={threadData.interrupts[0].config} />
      </div>
      <p className="col-span-1 text-gray-600 dark:text-gray-300 font-light text-sm">
        {updatedAtDateString}
      </p>
    </div>
  );
}
