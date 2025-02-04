import { Button } from "@/components/ui/button";
import { Thread } from "@langchain/langgraph-sdk";
import { ArrowLeft } from "lucide-react";
import { HumanInterrupt, ThreadData } from "../types";
import { constructOpenInStudioURL } from "../utils";
import { ThreadIdCopyable } from "./thread-id";
import { InboxItemInput } from "./inbox-item-input";
import useInterruptedActions from "../hooks/use-interrupted-actions";
import { TooltipIconButton } from "@/components/ui/assistant-ui/tooltip-icon-button";
import { VIEW_STATE_THREAD_QUERY_PARAM } from "../constants";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useQueryParams } from "../hooks/use-query-params";
import { useThreadsContext } from "../contexts/ThreadContext";

interface ThreadActionsViewProps< // ThreadActionView 컴포넌트가 받을 props 정리
  ThreadValues extends Record<string, any> = Record<string, any>,
> {
  threadData: {
    thread: Thread<ThreadValues>;
    status: "interrupted";
    interrupts: HumanInterrupt[];
  };
  setThreadData: React.Dispatch<
    React.SetStateAction<ThreadData<ThreadValues> | undefined> // thread 데이터 업데이트
  >;
  handleShowSidePanel: (showState: boolean, showDescription: boolean) => void;
  showState: boolean;
  showDescription: boolean;
}

function ButtonGroup({ // state와 description의 보이기를 관리하는 버튼 그룹 컴포넌트
  handleShowState,
  handleShowDescription,
  showingState,
  showingDescription,
}: {
  handleShowState: () => void;
  handleShowDescription: () => void;
  showingState: boolean;
  showingDescription: boolean;
}) {
  return (
    <div className="flex flex-row gap-0 items-center justify-center">
      <Button
        variant="outline"
        className={cn(
          "rounded-l-md rounded-r-none border-r-[0px]",
          showingState ? "text-black dark:text-white" : "bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-gray-800"
        )}
        size="sm"
        onClick={handleShowState}
      >
        State
      </Button>
      <Button
        variant="outline"
        className={cn(
          "rounded-l-none rounded-r-md border-l-[0px]",
          showingDescription ? "text-black dark:text-white" : "bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-gray-800"
        )}
        size="sm"
        onClick={handleShowDescription}
      >
        Description
      </Button>
    </div>
  );
}

export function ThreadActionsView< // 메인 앱 컴포넌트
  ThreadValues extends Record<string, any> = Record<string, any>, // 전달 받을 props 정리
>({
  threadData,
  setThreadData,
  handleShowSidePanel,
  showDescription,
  showState,
}: ThreadActionsViewProps<ThreadValues>) {
  const {
    acceptAllowed,
    hasEdited,
    hasAddedResponse,
    streaming,
    supportsMultipleMethods,
    streamFinished,
    currentNode,
    loading,
    handleSubmit,
    handleIgnore,
    handleResolve,
    setSelectedSubmitType,
    setHasAddedResponse,
    setHasEdited,
    humanResponse,
    setHumanResponse,
    initialHumanInterruptEditValue,
  } = useInterruptedActions<ThreadValues>({ // threaddata와 setthreaddata를 업데이트하기위한 useInterruptedActions 커스텀 훅
    threadData,
    setThreadData,
  });
  const { agentInboxes } = useThreadsContext<ThreadValues>();
  const { toast } = useToast();
  const { updateQueryParams } = useQueryParams();

  const deploymentUrl = agentInboxes.find((i) => i.selected)?.deploymentUrl; // 사용자가 선택한 agent inbox의 deployment url를 가져오는 함수

  const handleOpenInStudio = () => { // 사용자가 선택한 agent inbox의 deployment url를 사용하여 studio를 여는 함수
    if (!deploymentUrl) {
      toast({
        title: "Error",
        description: "Please set the LangGraph deployment URL in settings.",
        duration: 5000,
      });
      return;//에러면 toast 훅
    }

    const studioUrl = constructOpenInStudioURL(
      deploymentUrl,
      threadData.thread.thread_id
    );
    window.open(studioUrl, "_blank");// url이 존재하면 새로운 탭에서 스튜디오 열기
  };

  const threadTitle =
    threadData.interrupts[0].action_request.action || "Unknown"; // 스레드에서 첫 번째 interrupt 객체의 action 값을 가져오기
  const actionsDisabled = loading || streaming;

  return ( // UI를 반환
    <div className="flex flex-col min-h-full w-full p-12 gap-9">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between w-full gap-3">
        <div className="flex items-center justify-start gap-3">
          <TooltipIconButton // Back 버튼을 불러오기 위한 컴포넌트
            variant="ghost"
            onClick={() => updateQueryParams(VIEW_STATE_THREAD_QUERY_PARAM)} 
            tooltip="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </TooltipIconButton>
          <p className="text-2xl tracking-tighter text-pretty">{threadTitle}</p>
          <ThreadIdCopyable threadId={threadData.thread.thread_id} />
        </div>
        <div className="flex flex-row gap-2 items-center justify-start">
          {deploymentUrl && (
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-1 bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={handleOpenInStudio}
            >
              Studio
            </Button>
          )}
          <ButtonGroup
            handleShowState={() => handleShowSidePanel(true, false)}
            handleShowDescription={() => handleShowSidePanel(false, true)}
            showingState={showState}
            showingDescription={showDescription}
          />
        </div>
      </div>

      <div className="flex flex-row gap-2 items-center justify-start w-full">
        <Button
          variant="outline"
          className="text-green-500 dark:text-gray-200 border-green-400 font-normal bg-white dark:bg-gray-900 hover:bg-green-50 dark:hover:bg-green-500 hover:text-green-700 dark:hover:text-black"
          onClick={handleResolve}
          disabled={actionsDisabled}
        >
          Mark as Resolved
        </Button>
        <Button
          variant="outline"
          className="text-red-600 dark:text-red-700 border-red-700 font-normal bg-white dark:bg-gray-900 hover:bg-red-50 dark:hover:bg-red-800 hover:text-red-700 dark:hover:text-red-300"
          onClick={handleIgnore}
          disabled={actionsDisabled}
        >
          Ignore
        </Button>
      </div>

      {/* Actions */}
      <InboxItemInput // 편집이나 유저가 개입하는 인박스를 불러오는 컴포넌트
        acceptAllowed={acceptAllowed}
        hasEdited={hasEdited}
        hasAddedResponse={hasAddedResponse}
        interruptValue={threadData.interrupts[0]}
        humanResponse={humanResponse}
        initialValues={initialHumanInterruptEditValue.current}
        setHumanResponse={setHumanResponse}
        streaming={streaming}
        streamFinished={streamFinished}
        currentNode={currentNode}
        supportsMultipleMethods={supportsMultipleMethods}
        setSelectedSubmitType={setSelectedSubmitType}
        setHasAddedResponse={setHasAddedResponse}
        setHasEdited={setHasEdited}
        handleSubmit={handleSubmit}
      />
    </div>
  );
}
