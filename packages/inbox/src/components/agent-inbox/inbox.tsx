import { useThreadsContext } from "@/components/agent-inbox/contexts/ThreadContext";
import { useEffect } from "react";
import { InboxItem } from "./components/inbox-item";
import React from "react";
import { useQueryParams } from "./hooks/use-query-params";
import {
  INBOX_PARAM,
  LIMIT_PARAM,
  OFFSET_PARAM,
  VIEW_STATE_THREAD_QUERY_PARAM,
} from "./constants";
import { TighterText } from "../ui/header";
import { PillButton } from "../ui/pill-button";
import { ThreadData, ThreadStatusWithAll } from "./types";
import { cn } from "@/lib/utils";
import { Pagination } from "./components/pagination";
import { Inbox as InboxIcon, LoaderCircle } from "lucide-react";

export function Inbox<
  ThreadValues extends Record<string, any> = Record<string, any>,
>() {
  const { searchParams, updateQueryParams, getSearchParam } = useQueryParams();
  const { loading, threadData } = useThreadsContext<ThreadValues>();
  const [selectedInbox, setSelectedInbox] =
    React.useState<ThreadStatusWithAll>("interrupted");

  const selectedThreadId = searchParams.get(VIEW_STATE_THREAD_QUERY_PARAM);
  const isStateViewOpen = !!selectedThreadId;

  const shouldClearSelectedThread = (
    selectedThreadId: string | null,
    threads: ThreadData<ThreadValues>[],
    inboxStatus: ThreadStatusWithAll
  ) => {
    if (!selectedThreadId) return false;
    if (inboxStatus === "all") return false;
    return !threads.find(
      (t) => t.thread.thread_id === selectedThreadId && t.status === inboxStatus
    );
  };

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const currentInbox = getSearchParam(INBOX_PARAM) as
      | ThreadStatusWithAll
      | undefined;
    if (!currentInbox) {
      // Set default inbox if none selected
      updateQueryParams(INBOX_PARAM, selectedInbox);
    } else {
      setSelectedInbox(currentInbox);
    }

    // Clear selected thread if it's not in the current inbox
    if (threadData.length && selectedThreadId) {
      const inboxToCheck = currentInbox || selectedInbox;
      if (
        shouldClearSelectedThread(selectedThreadId, threadData, inboxToCheck)
      ) {
        updateQueryParams(VIEW_STATE_THREAD_QUERY_PARAM);
      }
    }
  }, [searchParams]);

  const changeInbox = async (inbox: ThreadStatusWithAll) => {
    updateQueryParams(
      [INBOX_PARAM, OFFSET_PARAM, LIMIT_PARAM],
      [inbox, "0", "10"]
    );
    setSelectedInbox(inbox);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const offsetQueryParam = getSearchParam(OFFSET_PARAM);
    const limitQueryParam = getSearchParam(LIMIT_PARAM);
    if (!offsetQueryParam) {
      updateQueryParams(OFFSET_PARAM, "0");
    }
    if (!limitQueryParam) {
      updateQueryParams(LIMIT_PARAM, "10");
    }
  }, [searchParams]);

  const threadDataToRender = threadData.filter((t) => {
    if (selectedInbox === "all") return true;
    return t.status === selectedInbox;
  });
  const noThreadsFound = !threadDataToRender.length;

  return (
    <div className="w-full pb-10 pt-2 px-12 rounded-[58px] bg-white h-full overflow-y-auto">
      <div
        className={cn(
          "flex items-center justify-between pt-6",
          isStateViewOpen ? "max-w-[60%] w-full" : "w-full"
        )}
      >
        <TighterText className="text-3xl font-medium">Inbox</TighterText>
      </div>
      <div className="flex gap-2 items-center justify-start mt-5">
        <PillButton
          onClick={() => changeInbox("all")}
          variant={selectedInbox === "all" ? "default" : "outline"}
        >
          All
        </PillButton>
        <PillButton
          onClick={() => changeInbox("interrupted")}
          variant={selectedInbox === "interrupted" ? "default" : "outline"}
        >
          Interrupted
        </PillButton>
        <PillButton
          onClick={() => changeInbox("idle")}
          variant={selectedInbox === "idle" ? "default" : "outline"}
        >
          Idle
        </PillButton>
        <PillButton
          onClick={() => changeInbox("busy")}
          variant={selectedInbox === "busy" ? "default" : "outline"}
        >
          Busy
        </PillButton>
        <PillButton
          onClick={() => changeInbox("error")}
          variant={selectedInbox === "error" ? "default" : "outline"}
        >
          Error
        </PillButton>
      </div>
      <div className="my-5">
        <div className="grid grid-cols-12 w-full px-4 py-2">
          <div className="col-span-9">
            <p className="text-gray-500 text-sm tracking-wide">TITLE</p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-500 text-sm tracking-wide">STATUS</p>
          </div>
          <div className="col-span-1">
            <p className="text-gray-500 text-sm tracking-wide">DATE</p>
          </div>
        </div>
        <div className="flex flex-col items-start w-full h-full border-[1px] border-gray-200 rounded-xl shadow-sm overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {threadDataToRender.map((threadData, idx) => {
            return (
              <InboxItem<ThreadValues>
                key={`inbox-item-${threadData.thread.thread_id}`}
                threadData={threadData}
                isLast={idx === threadDataToRender.length - 1}
              />
            );
          })}
          {noThreadsFound && !loading && (
            <div className="w-full flex items-center justify-center p-4">
              <div className="flex gap-2 items-center justify-center text-gray-700">
                <InboxIcon className="w-6 h-6" />
                <p className="font-medium">No threads found</p>
              </div>
            </div>
          )}
          {noThreadsFound && loading && (
            <div className="w-full flex items-center justify-center p-4">
              <div className="flex gap-2 items-center justify-center text-gray-700">
                <p className="font-medium">Loading</p>
                <LoaderCircle className="w-6 h-6 animate-spin" />
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-start w-full my-5">
          <Pagination />
        </div>
      </div>
    </div>
  );
}
