import { cn } from "@/lib/utils";
import { Thread } from "@langchain/langgraph-sdk";
import React from "react";
import { ThreadIdCopyable } from "./thread-id";
import { InboxItemStatuses } from "./statuses";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { constructOpenInStudioURL } from "../utils";
import { Button } from "@/components/ui/button";
import NextLink from "next/link";
import { useThreadsContext } from "../contexts/ThreadContext";
import DeleteButton from '@/components/ui/deleteItem';

interface GenericInboxItemProps<
  ThreadValues extends Record<string, any> = Record<string, any>,
> {
  threadData: {
    thread: Thread<ThreadValues>;
    status: "idle" | "busy" | "error" | "interrupted";
    interrupts?: never | undefined;
  };
  isLast: boolean;
}

export function GenericInboxItem<
  ThreadValues extends Record<string, any> = Record<string, any>,
>({ threadData, isLast }: GenericInboxItemProps<ThreadValues>) {
  const { agentInboxes, ignoreThread } = useThreadsContext<ThreadValues>();
  const { toast } = useToast();

  const deploymentUrl = agentInboxes.find((i) => i.selected)?.deploymentUrl;

  const handleOpenInStudio = () => {
    if (!deploymentUrl) {
      toast({
        title: "Error",
        description: "Please set the LangGraph deployment URL in settings.",
        duration: 5000,
      });
      return;
    }

    const studioUrl = constructOpenInStudioURL(
      deploymentUrl,
      threadData.thread.thread_id
    );
    window.open(studioUrl, "_blank");
  };

  const updatedAtDateString = format(
    new Date(threadData.thread.updated_at),
    "MM/dd h:mm a"
  );

  return (
    <div
      className={cn(
        "grid grid-cols-12 w-full p-7 items-center",
        !isLast && "border-b-[1px] border-gray-200 dark:border-gray-800"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-start gap-2",
          deploymentUrl ? "col-span-7" : "col-span-9"
        )}
      >
        <p className="text-black dark:text-gray-200 text-sm font-semibold">Thread ID</p>
        <ThreadIdCopyable showUUID threadId={threadData.thread.thread_id} />
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
              onClick={handleOpenInStudio}
            >
              Studio
            </Button>
          </NextLink>
        </div>
      )}
      <DeleteButton threadId={threadData.thread.thread_id} />

      <div className="col-span-2">
        <InboxItemStatuses status={threadData.status} />
      </div>

      <p className="col-span-1 text-gray-600 dark:text-gray-400 font-light text-sm">
        {updatedAtDateString}
      </p>
    </div>
  );
}
