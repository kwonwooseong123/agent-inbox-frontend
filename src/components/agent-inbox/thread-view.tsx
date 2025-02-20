import { Thread } from "@langchain/langgraph-sdk";
import { StateView } from "./components/state-view";
import { ThreadActionsView } from "./components/thread-actions-view";
import { useThreadsContext } from "./contexts/ThreadContext";
import { HumanInterrupt, ThreadData } from "./types";
import React from "react";
import { cn } from "@/lib/utils";
import { useQueryParams } from "./hooks/use-query-params";
import { VIEW_STATE_THREAD_QUERY_PARAM } from "./constants";

export function ThreadView<
  ThreadValues extends Record<string, any> = Record<string, any>,
>({ threadId }: { threadId: string }) {
  const { updateQueryParams } = useQueryParams();
  const { threadData: threads, loading } = useThreadsContext<ThreadValues>();
  const [threadData, setThreadData] =
    React.useState<ThreadData<ThreadValues>>();
  const [showDescription, setShowDescription] = React.useState(true);
  const [showState, setShowState] = React.useState(false);
  const showSidePanel = showDescription || showState;

  React.useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (!threadId || !threads.length || loading) return; // threadId를 사용하지 않는 경우 index.tsx로 돌아감
      const selectedThread = threads.find(
        (t) => t.thread.thread_id === threadId
      );
      if (selectedThread) {
        setThreadData(selectedThread);
        return;// 전달받은 threadId를 사용하여 thread 데이터 가져오고 threadData state에 저장 후 리렌더링
      } else {
        // Route the user back to the inbox view.
        updateQueryParams(VIEW_STATE_THREAD_QUERY_PARAM); // url 업데이트로 인박스뷰로 유저 반환
      }
    } catch (e) {
      console.error("Error updating query params & setting thread data", e);
    }
  }, [threads, loading, threadId]);

  const handleShowSidePanel = (
    showState: boolean,
    showDescription: boolean
  ) => {
    if (showState && showDescription) {
      console.error("Cannot show both state and description");
      return;
    }
    if (showState) {
      setShowDescription(false);
      setShowState(true);
    } else if (showDescription) {
      setShowState(false);
      setShowDescription(true);
    } else {
      setShowState(false);
      setShowDescription(false);
    }
  }; // 스테이트와 디스크립션 상태에 따라 사이드패널 보여줌

  if (
    !threadData ||
    threadData.status !== "interrupted" ||
    !threadData.interrupts ||
    threadData.interrupts.length === 0
  ) {
    return null;
  } // threadData가 null 이거나 interrupt 스테이터스가 아닌경우 null 반환

  return (
    <div className="flex flex-col lg:flex-row w-full h-full">
      <div
        className={cn(
          "flex overflow-y-auto",
          showSidePanel ? "lg:min-w-1/2 lg:max-w-2xl w-full" : "w-full"
        )}
      >
        <ThreadActionsView<ThreadValues> // threadActionsView.tsx 컴포넌트에 props와 state 전달
          threadData={
            threadData as {
              thread: Thread<ThreadValues>;
              status: "interrupted";
              interrupts: HumanInterrupt[];
            }
          }
          setThreadData={setThreadData}
          handleShowSidePanel={handleShowSidePanel}
          showState={showState}
          showDescription={showDescription}
        />
      </div>
      <div
        className={cn(
          showSidePanel ? "flex" : "hidden",
          "overflow-y-auto lg:max-w-1/2 w-full"
        )}
      >
        <StateView
          handleShowSidePanel={handleShowSidePanel}
          threadData={threadData}
          view={showState ? "state" : "description"}
        />
      </div>
    </div>
  );
}
