import { ChevronRight, X, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import {
  baseMessageObject,
  isArrayOfMessages,
  prettifyText,
  unknownToPrettyDate,
} from "../utils";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { BaseMessage } from "@langchain/core/messages";
import { ToolCall } from "@langchain/core/messages/tool";
import React from "react";
import { Button } from "../../ui/button";
import { ToolCallTable } from "./tool-call-table";
import { MarkdownText } from "@/components/ui/markdown-text";
import { ThreadData } from "../types";

interface StateViewRecursiveProps {
  value: unknown;
  expanded?: boolean;
}

const messageTypeToLabel = (message: BaseMessage) => {
  let type = "";
  if ("type" in message) {
    type = message.type as string;
  } else {
    type = message._getType();
  }

  switch (type) {
    case "human":
      return "User";
    case "ai":
      return "Assistant";
    case "tool":
      return "Tool";
    case "System":
      return "System";
    default:
      return "";
  }
};

function MessagesRenderer({ messages }: { messages: BaseMessage[] }) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {messages.map((msg, idx) => { // msg 의 인덱스를 받아옴
        const messageTypeLabel = messageTypeToLabel(msg);
        const content =
          typeof msg.content === "string" // msg의 content 타입을 확인하고, 문자열인 경우 msg의 content를 출력하고, 객체인 경우 JSON.stringify를 사용하여 출력
            ? msg.content
            : JSON.stringify(msg.content, null);
        return (
          <div
            key={msg.id || `message-${idx}`}
            className="flex flex-col gap-[2px] ml-2 w-full"
          >
            <p className="font-medium text-gray-700">{messageTypeLabel}:</p>
            {content && (
              <MarkdownText className="text-gray-600">{content}</MarkdownText> // agent inbox의 response의 content를 markdown 텍스트로 출력
            )}
            {"tool_calls" in msg && msg.tool_calls ? (
              <div className="flex flex-col gap-1 items-start w-full">
                {(msg.tool_calls as ToolCall[]).map((tc, idx) => (
                  <ToolCallTable
                    key={tc.id || `tool-call-${idx}`}
                    toolCall={tc}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function StateViewRecursive(props: StateViewRecursiveProps) {
  const date = unknownToPrettyDate(props.value);
  if (date) {
    return (
      <p className="font-light text-gray-600 dark:text-gray-200">{date}</p>
    );
  }

  if (["string", "number"].includes(typeof props.value)) {
    return (
      <MarkdownText className="font-light text-gray-600 dark:text-gray-200">
        {props.value as string}
      </MarkdownText>
    );
  }

  if (typeof props.value === "boolean") {
    return (
      <MarkdownText className="font-light text-gray-600 dark:text-gray-200">
        {JSON.stringify(props.value)}
      </MarkdownText>
    );
  }

  if (props.value == null) {
    return <p className="font-light text-gray-600 dark:text-gray-200 whitespace-pre-wrap">null</p>;
  }

  if (Array.isArray(props.value)) {
    if (props.value.length > 0 && isArrayOfMessages(props.value)) {
      return <MessagesRenderer messages={props.value} />;
    }

    const valueArray = props.value as unknown[];
    return (
      <div className="flex flex-row gap-1 items-start justify-start w-full">
        <span className="font-normal text-black dark:text-white">[</span>
        {valueArray.map((item, idx) => {
          const itemRenderValue = baseMessageObject(item);
          return (
            <div
              key={`state-view-${idx}`}
              className="flex flex-row items-start whitespace-pre-wrap w-full"
            >
              <StateViewRecursive value={itemRenderValue} />
              {idx < valueArray?.length - 1 && (
                <span className="text-black dark:text-white font-normal">,&nbsp;</span>
              )}
            </div>
          );
        })}
        <span className="font-normal text-black dark:text-white">]</span>
      </div>
    );
  }

  if (typeof props.value === "object") {
    if (Object.keys(props.value).length === 0) {
      return <p className="font-light text-gray-600 dark:text-gray-200">{"{}"}</p>;
    }
    return (
      <div className="flex flex-col gap-1 items-start justify-start ml-6 relative w-full">
        {/* Vertical line */}
        <div className="absolute left-[-24px] top-0 h-full w-[1px] bg-gray-200 dark:bg-gray-800" />

        {Object.entries(props.value).map(([key, value], idx) => (
          <div
            key={`state-view-object-${key}-${idx}`}
            className="relative w-full"
          >
            {/* Horizontal connector line */}
            <div className="absolute left-[-20px] top-[10px] h-[1px] w-[18px] bg-gray-200 dark:bg-gray-800" />
            <StateViewObject
              expanded={props.expanded}
              keyName={key}
              value={value}
            />
          </div>
        ))}
      </div>
    );
  }
}

function HasContentsEllipsis({ onClick }: { onClick?: () => void }) {
  return (
    <span
      onClick={onClick}
      className={cn(
        "font-mono text-[10px] leading-3 p-[2px] rounded-md",
        "bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-800",
        "transition-colors ease-in-out cursor-pointer",
        "-translate-y-[2px] inline-block",
        "dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      )}
    >
      {"{...}"}
    </span>
  );
}

interface StateViewProps {
  keyName: string;
  value: unknown;
  /**
   * Whether or not to expand or collapse the view
   * @default true
   */
  expanded?: boolean;
}

export function StateViewObject(props: StateViewProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (props.expanded != null) {
      setExpanded(props.expanded);
    }
  }, [props.expanded]);

  return (
    <div className="flex flex-row gap-2 items-start justify-start relative text-sm">
      <motion.div
        initial={false}
        animate={{ rotate: expanded ? 90 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <div
          onClick={() => setExpanded((prev) => !prev)}
          className="w-5 h-5 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-black dark:text-gray-300 dark:hover:text-gray-300 rounded-md transition-colors ease-in-out cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </div>
      </motion.div>
      <div className="flex flex-col gap-1 items-start justify-start w-full">
        <p className="text-black dark:text-white font-normal">
          {prettifyText(props.keyName)}{" "}
          {!expanded && (
            <HasContentsEllipsis onClick={() => setExpanded((prev) => !prev)} /> // ...으로 내용 expand state 변경 후 state reculsive 컴포넌트 사용
          )}
        </p>
        <motion.div
          initial={false}
          animate={{
            height: expanded ? "auto" : 0,
            opacity: expanded ? 1 : 0,
          }}
          transition={{
            duration: 0.2,
            ease: "easeInOut",
          }}
          style={{ overflow: "hidden" }}
          className="relative w-full"
        >
          <StateViewRecursive // AI로 생성된 content 컴포넌트
            expanded={props.expanded}
            value={props.value}
          />
        </motion.div>
      </div>
    </div>
  );
}

interface StateViewComponentProps {
  threadData: ThreadData<Record<string, any>>;
  handleShowSidePanel: (showState: boolean, showDescription: boolean) => void;
  view: "description" | "state";
}

export function StateView({
  threadData,
  handleShowSidePanel,
  view,
}: StateViewComponentProps) {
  const [expanded, setExpanded] = useState(false);

  const threadValues = threadData.thread.values;
  const description = threadData.interrupts?.[0].description;

  if (!threadValues) {
    return <div>No state found</div>;
  }

  return (
    <div className="overflow-y-auto pl-6 border-t-[1px] lg:border-t-[0px] lg:border-l-[1px] border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex flex-row gap-0 w-full">
      {view === "description" && (
        <div className="pt-6 pb-2">
          <MarkdownText className="text-wrap break-words whitespace-pre-wrap">
            {description || "No description provided"}
          </MarkdownText>
        </div>
      )}
      {view === "state" && (
        <div className="flex flex-col items-start justify-start gap-1 pt-6 pb-2">
          {Object.entries(threadValues).map(([k, v], idx) => ( // threadValues 를 배열로 만들어서 map이 접근가능하게 만들어줌
            <StateViewObject
              expanded={expanded}
              key={`state-view-${k}-${idx}`}
              keyName={k}
              value={v}
            />
          ))}
        </div>
      )}
      <div className="flex gap-2 items-start justify-end pt-6 pr-6">
        {view === "state" && (
          <Button
            onClick={() => setExpanded((prev) => !prev)}
            variant="ghost"
            className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            size="sm"
          >
            {expanded ? (
              <ChevronsUpDown className="w-4 h-4" />
            ) : (
              <ChevronsDownUp className="w-4 h-4" />
            )}
          </Button>
        )}

        <Button
          onClick={() => handleShowSidePanel(false, false)}
          variant="ghost"
          className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          size="sm"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
