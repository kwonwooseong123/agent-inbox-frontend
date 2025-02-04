"use client";

import { v4 as uuidv4, validate } from "uuid";
import {
  AgentInbox,
  HumanInterrupt,
  HumanResponse,
  ThreadData,
  ThreadStatusWithAll,
} from "@/components/agent-inbox/types";
import { useToast, type ToastInput } from "@/hooks/use-toast";
import { createClient } from "@/lib/client";
import {
  Run,
  Thread,
  ThreadState,
  ThreadStatus,
} from "@langchain/langgraph-sdk";
import { END } from "@langchain/langgraph/web";
import React from "react";
import { useQueryParams } from "../hooks/use-query-params";
import {
  INBOX_PARAM,
  LIMIT_PARAM,
  OFFSET_PARAM,
  AGENT_INBOX_PARAM,
  AGENT_INBOXES_LOCAL_STORAGE_KEY,
  LANGCHAIN_API_KEY_LOCAL_STORAGE_KEY,
  NO_INBOXES_FOUND_PARAM,
} from "../constants";
import {
  getInterruptFromThread,
  processInterruptedThread,
  processThreadWithoutInterrupts,
} from "./utils";
import { useLocalStorage } from "../hooks/use-local-storage";

type ThreadContentType<
  ThreadValues extends Record<string, any> = Record<string, any>,
> = {
  loading: boolean;
  threadData: ThreadData<ThreadValues>[];
  hasMoreThreads: boolean;
  agentInboxes: AgentInbox[];
  deleteAgentInbox: (id: string) => void;
  changeAgentInbox: (graphId: string, replaceAll?: boolean) => void;
  addAgentInbox: (agentInbox: AgentInbox) => void;
  ignoreThread: (threadId: string) => Promise<void>;
  fetchThreads: (inbox: ThreadStatusWithAll) => Promise<void>;
  sendHumanResponse: <TStream extends boolean = false>(
    threadId: string,
    response: HumanResponse[],
    options?: {
      stream?: TStream;
    }
  ) => TStream extends true
    ?
        | AsyncGenerator<{
            event: Record<string, any>;
            data: any;
          }>
        | undefined
    : Promise<Run> | undefined;
  fetchSingleThread: (threadId: string) => Promise<
    | {
        thread: Thread<ThreadValues>;
        status: ThreadStatus;
        interrupts: HumanInterrupt[] | undefined;
      }
    | undefined
  >;
};

const ThreadsContext = React.createContext<ThreadContentType | undefined>(
  undefined
); // 전역 데이터를 저장하는 역할을 하는 Thread Context 저장소

interface GetClientArgs {
  agentInboxes: AgentInbox[];
  getItem: (key: string) => string | null | undefined;
  toast: (input: ToastInput) => void;
}

const getClient = ({ agentInboxes, getItem, toast }: GetClientArgs) => {
  /* 
  LangGraph SDK client를 가져오는 함수. 
  가져오기전에 argument로 받은 agentInboxes(React.useState에 저장된)에 데이터가 들었는지 혹 deploymentUrl가 있는지 확인하고 Client 객체(클래스)를 반환해줌.
  아 참고로 현재 선택된 graph의 client를 가져옴. graph별로 client따로 만들어야하니까. 
  */
  if (agentInboxes.length === 0) {
    toast({
      title: "Error",
      description: "Agent inbox not found. Please add an inbox in settings. (",
      variant: "destructive",
      duration: 3000,
    });
    return;
  }
  const deploymentUrl = agentInboxes.find((i) => i.selected)?.deploymentUrl;
  if (!deploymentUrl) {
    toast({
      title: "Error",
      description:
        "Please ensure your selected agent inbox has a deployment URL.",
      variant: "destructive",
      duration: 5000,
    });
    return;
  }

  const langchainApiKeyLS = getItem(LANGCHAIN_API_KEY_LOCAL_STORAGE_KEY);
  if (!langchainApiKeyLS) {
    toast({
      title: "Error",
      description: "Please add your LangChain API key in settings.",
      variant: "destructive",
      duration: 5000,
    });
    return;
  }

  return createClient({ deploymentUrl, langchainApiKey: langchainApiKeyLS });
};

/*

######## 먼저 아래 함수 읽기전에 사전지식으로 가져야할 것들 ########

graph0(email-assitant) - [thread0, thread1, thread2, ....]
graph1(slack-assitant) - [thread0, thread1, thread2, ....]
...

agent inbox에는 하나의 에이전트 종류가 배정되며, url과 graph.id를 가지고있음. graph id는 langgraph백엔드의 해당 graph를 찾는데 사용(graph 랑 thread는 다른 개념임).
agent inboxes는 agent inbox들을 저장하는 array라고 생각하면 될듯

thread는 이메일당 하나가 배정됨 - 이메일 상태 등을 저장하는 객체가 정의되어있음

*/

export function ThreadsProvider<
  ThreadValues extends Record<string, any> = Record<string, any>,
>({ children }: { children: React.ReactNode }) {
  /*
  ThreadContext에서 사용되는 state, function, context, hook, client, etc.를 저장하는 역할을 하는 Thread 저장 데이터를(함수, 변수, 등등) 생성 및 children 컴포넌트에 전달해준다고 명시하는 함수
   */
  const { getSearchParam, searchParams, updateQueryParams } = useQueryParams();
  const { getItem, setItem } = useLocalStorage();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [threadData, setThreadData] = React.useState<
    ThreadData<ThreadValues>[]
  >([]);
  const [hasMoreThreads, setHasMoreThreads] = React.useState(true);
  const [agentInboxes, setAgentInboxes] = React.useState<AgentInbox[]>([]);

  const limitParam = searchParams.get(LIMIT_PARAM);
  const offsetParam = searchParams.get(OFFSET_PARAM);
  const inboxParam = searchParams.get(INBOX_PARAM);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!agentInboxes.length) {
      return;
    }
    const inboxSearchParam = getSearchParam(INBOX_PARAM) as ThreadStatusWithAll;
    if (!inboxSearchParam) {
      return;
    }
    try {
      fetchThreads(inboxSearchParam);
    } catch (e) {
      console.error("Error occurred while fetching threads", e);
    }
  }, [limitParam, offsetParam, inboxParam, agentInboxes]);

  const agentInboxParam = searchParams.get(AGENT_INBOX_PARAM);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      getAgentInboxes();
    } catch (e) {
      console.error("Error occurred while fetching agent inboxes", e);
    }
  }, [agentInboxParam]);

  const getAgentInboxes = React.useCallback(async () => {
    /*
    AgentInboxes를 가져오는 함수인데 (Agent inboxes는 langgraph에 어떤 graph들이 있는지 저장하는 저장소임)
     */
    const agentInboxSearchParam = getSearchParam(AGENT_INBOX_PARAM); // agentInbox.id를 가지고 오는 (id를 가지고 agent inboxes에서 AgentInbox객체를 가져올수있게)
    const agentInboxes = getItem(AGENT_INBOXES_LOCAL_STORAGE_KEY); // agentInbox들을 local storage에서 가져오는. [agentInbox1, agentInbox2, ...]
    if (!agentInboxes || !agentInboxes.length) {
      updateQueryParams(NO_INBOXES_FOUND_PARAM, "true"); // agent inboxes가 없는 경우 no_inboxes_found=true로 바꿔서 초기 url에 추가해서 popover의 add agent 실행
      return;
    }
    let parsedAgentInboxes: AgentInbox[] = [];
    try {
      parsedAgentInboxes = JSON.parse(agentInboxes);
    } catch (error) {
      console.error("Error parsing agent inboxes", error);
      toast({
        title: "Error",
        description: "Agent inbox not found. Please add an inbox in settings.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    } // AgentInbox 객체를 object ({a:1, b:2}) 형태로 바꾸는 코드

    if (!parsedAgentInboxes.length) {
      const noInboxesFoundParam = searchParams.get(NO_INBOXES_FOUND_PARAM);
      if (noInboxesFoundParam !== "true") {
        updateQueryParams(NO_INBOXES_FOUND_PARAM, "true");
      }
      return;
    } // AgentInbox에 저장된 데이터없으면 inbox없다고 갱신하는 코드

    // AgentInbox에 id없으면 추가하는 코드
    parsedAgentInboxes = parsedAgentInboxes.map((i) => {
      return {
        ...i,
        id: i.id || uuidv4(),
      };
    });

    // If there is no agent inbox search param, or the search param is not
    // a valid UUID, update search param and local storage
    if (!agentInboxSearchParam || !validate(agentInboxSearchParam)) {
      const selectedInbox = parsedAgentInboxes.find((i) => i.selected);
      if (!selectedInbox) {
        parsedAgentInboxes[0].selected = true;
        updateQueryParams(AGENT_INBOX_PARAM, parsedAgentInboxes[0].id);
        setAgentInboxes(parsedAgentInboxes);
        setItem(
          AGENT_INBOXES_LOCAL_STORAGE_KEY,
          JSON.stringify(parsedAgentInboxes)
        );
      } else {
        updateQueryParams(AGENT_INBOX_PARAM, selectedInbox.id);
        setAgentInboxes(parsedAgentInboxes);
        setItem(
          AGENT_INBOXES_LOCAL_STORAGE_KEY,
          JSON.stringify(parsedAgentInboxes)
        );
      }
      return;
    }

    const selectedInbox = parsedAgentInboxes.find(
      (i) =>
        i.id === agentInboxSearchParam || i.graphId === agentInboxSearchParam
    );
    if (!selectedInbox) {
      toast({
        title: "Error",
        description: "Agent inbox not found. Please add an inbox in settings.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    parsedAgentInboxes = parsedAgentInboxes.map((i) => {
      return {
        ...i,
        selected:
          i.id === agentInboxSearchParam || i.graphId === agentInboxSearchParam,
      };
    });
    setAgentInboxes(parsedAgentInboxes);
    setItem(
      AGENT_INBOXES_LOCAL_STORAGE_KEY,
      JSON.stringify(parsedAgentInboxes)
    );
  }, []);

  const addAgentInbox = React.useCallback((agentInbox: AgentInbox) => {
    /*
    Local storage에 저장된 agent inboxes를 가져와서
    새로 추가된 agent inbox (argument)를 넣는 함수
    */ 
    const agentInboxes = getItem(AGENT_INBOXES_LOCAL_STORAGE_KEY); // 먼저 agent inboxes ([agent inbox1, agent inbox2, ...])를 가져오고
    if (!agentInboxes || !agentInboxes.length) {
      setAgentInboxes([agentInbox]);
      setItem(AGENT_INBOXES_LOCAL_STORAGE_KEY, JSON.stringify([agentInbox]));
      updateQueryParams(AGENT_INBOX_PARAM, agentInbox.id);
      return;
    } // agent inboxes에 들어있는 agent inbox가없으면 새로  agent inbox를 추가하는 코드
    const parsedAgentInboxes = JSON.parse(agentInboxes);
    parsedAgentInboxes.push(agentInbox); // agent inboxes에 들어있는 agent inbox가 있는 경우 새로 agent inbox를 추가하는 코드
    setAgentInboxes(parsedAgentInboxes);
    setItem(
      AGENT_INBOXES_LOCAL_STORAGE_KEY,
      JSON.stringify(parsedAgentInboxes)
    );
    updateQueryParams(AGENT_INBOX_PARAM, agentInbox.id);
  }, []);

  const deleteAgentInbox = React.useCallback((id: string) => {
    /*
    Local storage에 저장된 agent inboxes를 가져와서
    해당 id의 agent inbox를 삭제하는 함수
    */ 
    const agentInboxes = getItem(AGENT_INBOXES_LOCAL_STORAGE_KEY);  // 먼저 agent inboxes ([agent inbox1, agent inbox2, ...])를 가져오고
    if (!agentInboxes || !agentInboxes.length) {
      return;
    } // agent inboxes가 비어있으면 그냥 아무것도 안함
    const parsedAgentInboxes: AgentInbox[] = JSON.parse(agentInboxes);
    const updatedAgentInboxes = parsedAgentInboxes.filter((i) => i.id !== id); // agent inboxes존재하면 id(argument)를 기반으로 찾아서 없앰

    if (!updatedAgentInboxes.length) {
      updateQueryParams(NO_INBOXES_FOUND_PARAM, "true");
      setAgentInboxes([]);
      setItem(AGENT_INBOXES_LOCAL_STORAGE_KEY, JSON.stringify([]));
      // Clear all query params
      const url = new URL(window.location.href);
      window.location.href = url.pathname;
      return;
    } // 찾아서 없앤다음에 agent inboxes가 비어있으면 그냥 다 초기화

    setAgentInboxes(updatedAgentInboxes);
    setItem(
      AGENT_INBOXES_LOCAL_STORAGE_KEY,
      JSON.stringify(updatedAgentInboxes)
    );
    changeAgentInbox(updatedAgentInboxes[0].id, true); // 찾아서 없앤다음에 agent inboxes가 비어있지않으면 그냥 업데이트
  }, []);

  const changeAgentInbox = (id: string, replaceAll?: boolean) => {
    /*
    agent inbox의 id를 바꾸는 함수
    */ 
    setAgentInboxes((prev) =>
      prev.map((i) => ({
        ...i,
        selected: i.id === id,
      }))
    ); // 먼저 agent inboxes로 부터 해당 id의 agent inbox의 selected property(key)를 true로 바꿈
    if (!replaceAll) {
      updateQueryParams(AGENT_INBOX_PARAM, id); 
    } else {
      const url = new URL(window.location.href);
      const newParams = new URLSearchParams({
        [AGENT_INBOX_PARAM]: id,
      });
      const newUrl = url.pathname + "?" + newParams.toString();
      window.location.href = newUrl;
    } // 해당 agent inbox의 id로 현재 url의 파라미터를 바꿈
  };

  const fetchThreads = React.useCallback(
    /*
    inbox(argument) 는 우리가 본 state(all, busy, idle, ....) 을 받고
    해당 state에 속하는 agent inbox(email)을 가져오는 함수
    */
    async (inbox: ThreadStatusWithAll) => {
      setLoading(true);
      const client = getClient({
        agentInboxes,
        getItem,
        toast,
      }); // langgraph sdk 클라이언트 가져오고 
      if (!client) {
        return;
      }

      try {
        const limitQueryParam = getSearchParam(LIMIT_PARAM);
        if (!limitQueryParam) {
          throw new Error("Limit query param not found");
        }
        const offsetQueryParam = getSearchParam(OFFSET_PARAM);
        if (!offsetQueryParam) {
          throw new Error("Offset query param not found");
        }
        const limit = Number(limitQueryParam); // 한번에 가져오는 agent inbox(email)의 개수
        const offset = Number(offsetQueryParam); // 

        if (limit > 100) {
          toast({
            title: "Error",
            description: "Cannot fetch more than 100 threads at a time",
            variant: "destructive",
            duration: 3000,
          });
          return;
        } // 100개까지만 가져오게 해놓음
        const statusInput = inbox === "all" ? {} : { status: inbox };

        const threadSearchArgs = {
          offset,
          limit,
          ...statusInput,
        }; // langgraph backend에 이 설정을 보내면 이 설정대로 해당 agent inbox thread (email)을 가져오는 함수
        const threads = await client.threads.search(threadSearchArgs); // threadSearchArgs의 설정에  해당하는 thread들만 가져오는 코드 [thread1, thread2, ...]
        const data: ThreadData<ThreadValues>[] = []; // <- 이거 데이터 타입 들어가서 보면 어떤 정보들 있는지 볼 수 있음, 가져온 thread를 후처리해서 저장하는 변수임

        if (["interrupted", "all"].includes(inbox)) { // inbox가 interrupted거나 all인 경우만 실행
          const interruptedThreads = threads.filter(
            (t) => t.status === "interrupted"
          ); // 가져온 thread들 중 interrupted 상태의 thread들만 필터링함.

          // Process threads with interrupts in their thread object
          const processedThreads = interruptedThreads
            .map((t) => processInterruptedThread(t as Thread<ThreadValues>))
            .filter((t): t is ThreadData<ThreadValues> => !!t); // 이건 그냥 데이터 처리하는 건데, thread에 포함된 데이터를 { thread, interrupts: HumanInterrupt, status } 데이터 타입으로 변환 처리하는 듯
          data.push(...processedThreads); 
          /*
          export interface HumanInterrupt {
            action_request: ActionRequest;
            config: HumanInterruptConfig;
            description?: string;
          }
          */

          // [LEGACY]: Process threads that need state lookup
          const threadsWithoutInterrupts = interruptedThreads.filter(
            (t) => !getInterruptFromThread(t)?.length
          ); // thread의 state가 interrupted인데 thread.interrupted에 아무것도 없는 것들만 필터링하는 듯? 

          if (threadsWithoutInterrupts.length > 0) {
            const states = await bulkGetThreadStates(
              threadsWithoutInterrupts.map((t) => t.thread_id)
            ); // 해당 threadWithoutInterruptes의 thread ids에 해당하는 thread정보들을 langgraph backend에서 다시 가져옴 (왜 이짓거리를 하지? 뭔가 체크하려는건가?)

            const interruptedData = states.map((state) => { // 뭔가 각 thread별로 processThreadWithoutInterrupts처리를 하려는것같은데 뭘까? (뭔가 의미가있는것같은데 나중에 확인해볼게)
              const thread = threadsWithoutInterrupts.find(
                (t) => t.thread_id === state.thread_id
              );  
              if (!thread) {
                throw new Error(`Thread not found: ${state.thread_id}`);
              }
              return processThreadWithoutInterrupts(
                thread as Thread<ThreadValues>,
                state
              ); // 적당히 처리해서 
            });

            data.push(...interruptedData);
          }
        }

        threads.forEach((t) => {
          if (t.status === "interrupted") {
            return;
          }
          data.push({
            status: t.status,
            thread: t as Thread<ThreadValues>,
          });
        }); // 가져온 threads를 data 변수에 저장하는 과정

        // Sort data by created_at in descending order (most recent first)
        const sortedData = data.sort((a, b) => {
          return (
            new Date(b.thread.created_at).getTime() -
            new Date(a.thread.created_at).getTime()
          );
        }); // thread 생성된 시각을 기점으로 정렬하는 코드

        setThreadData(sortedData); // 정렬된 sortedDate를 React.state에 set하는 코드
        setHasMoreThreads(threads.length === limit); // 정렬된 sortedDate의 개수가 limit을 넘었는지 확인하는 state를 React.state에 저장하는 코드
      } catch (e) {
        console.error("Failed to fetch threads", e);
      }
      setLoading(false);
    },
    [agentInboxes] //  agentinboxes에 변화가 있을때마다 함수초기화(useCallback 유튜브 강의 들으셈) url: https://www.youtube.com/watch?v=XfUF9qLa3mU
  );

  const fetchSingleThread = React.useCallback(
    async (
      threadId: string
    ): Promise<
      | {
          thread: Thread<ThreadValues>;
          status: ThreadStatus;
          interrupts: HumanInterrupt[] | undefined;
        }
      | undefined
    > => {
      /*
      이건 그냥 thread id를 기반으로 langgraph backend에서 해당하는 thread 정보를 가져오는 함수
      */ 
      const client = getClient({
        agentInboxes,
        getItem,
        toast,
      }); // Client객체 생성하고
      if (!client) { 
        return;
      }
      const thread = await client.threads.get(threadId); // threads들중 해당 thread id를 만족하는 thread정보 가져오고
      let threadInterrupts: HumanInterrupt[] | undefined;
      if (thread.status === "interrupted") { // 해당 thread의 상태가 interrupted (인간의 개입이 필요한 상태)이면 예외처리
        threadInterrupts = getInterruptFromThread(thread);
        if (!threadInterrupts || !threadInterrupts.length) {
          const state = await client.threads.getState(threadId);
          const { interrupts } = processThreadWithoutInterrupts(thread, {
            thread_state: state,
            thread_id: threadId,
          });
          threadInterrupts = interrupts;
        }
      }
      return {
        thread: thread as Thread<ThreadValues>,
        status: thread.status,
        interrupts: threadInterrupts,
      };
    },
    [agentInboxes] //  agentinboxes에 변화가 있을때마다 함수초기화(useCallback 유튜브 강의 들으셈) url: https://www.youtube.com/watch?v=XfUF9qLa3mU
  );

  const bulkGetThreadStates = React.useCallback(
    async (
      threadIds: string[]
    ): Promise<
      { thread_id: string; thread_state: ThreadState<ThreadValues> }[]
    > => {
      /*
      thread ids(argument) 받아서, langgraph backend에 해당 thread ids의 threads를 나눠서 가져오는 함수(나눠서 처리하는 건 메모리 때문인가?)
      */
      const client = getClient({
        agentInboxes,
        getItem,
        toast,
      });
      if (!client) {
        return [];
      }
      const chunkSize = 25;
      const chunks = [];

      // Split threadIds into chunks of 25
      for (let i = 0; i < threadIds.length; i += chunkSize) {
        chunks.push(threadIds.slice(i, i + chunkSize));
      }

      // Process each chunk sequentially
      const results: {
        thread_id: string;
        thread_state: ThreadState<ThreadValues>;
      }[] = [];
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(async (id) => ({
            thread_id: id,
            thread_state: await client.threads.getState<ThreadValues>(id),
          }))
        );
        results.push(...chunkResults);
      }

      return results;
    },
    [agentInboxes]
  );

  const ignoreThread = async (threadId: string) => {
    /*
    이건 그냥 해당 threadId(argument)를 강제 종료 시킴(END 상태로 만들어버려서 langgraph backend에 thread를 종료시켜버리는 함수인듯)
    */
    const client = getClient({
      agentInboxes,
      getItem,
      toast,
    });
    if (!client) {
      return;
    }
    try {
      await client.threads.updateState(threadId, {
        values: null,
        asNode: END,
      }); // langgraph backend에서 thread의 상태를 END로 변경하는 함수

      setThreadData((prev) => {
        return prev.filter((p) => p.thread.thread_id !== threadId);
      });
      toast({
        title: "Success",
        description: "Ignored thread",
        duration: 3000,
      });
    } catch (e) {
      console.error("Error ignoring thread", e);
      toast({
        title: "Error",
        description: "Failed to ignore thread",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const sendHumanResponse = <TStream extends boolean = false>(
    threadId: string,
    response: HumanResponse[],
    options?: {
      stream?: TStream;
    }
  ): TStream extends true
    ?
        | AsyncGenerator<{
            event: Record<string, any>;
            data: any;
          }>
        | undefined
    : Promise<Run> | undefined => {
    /*
    이건 agent inboxes들에서 해당 threadId(argument)에 해당하는 graph (agent의 이름이라고 생각하면 될듯 email 에이전트랑 slack 에이전트를 같이 베포했다고 했을 댸 graph id == email or slack이렇게)
    에 인간이 입력한 response(argument)를 보내는 함수
    */ 
    const graphId = agentInboxes.find((i) => i.selected)?.graphId;
    if (!graphId) {
      toast({
        title: "No assistant/graph ID found.",
        description:
          "Assistant/graph IDs are required to send responses. Please add an assistant/graph ID in the settings.",
        variant: "destructive",
      });
      return undefined;
    }

    const client = getClient({
      agentInboxes,
      getItem,
      toast,
    }); // client생성하고
    if (!client) {
      return;
    }
    try {
      if (options?.stream) {
        return client.runs.stream(threadId, graphId, {
          command: {
            resume: response,
          }, // 해당 thread에 인간 response를 보냄
          streamMode: "events",
        }) as any; // Type assertion needed due to conditional return type
      }
      return client.runs.create(threadId, graphId, {
        command: {
          resume: response,
        }, // stream은 나눠서 보내는거고, create은 한번에 보내는 거임 별차이없음 (메모리 용량에 따라 다를듯)
      }) as any; // Type assertion needed due to conditional return type
    } catch (e: any) {
      console.error("Error sending human response", e);
      throw e;
    }
  };

  const contextValue: ThreadContentType = {
    loading,
    threadData,
    hasMoreThreads,
    agentInboxes,
    deleteAgentInbox,
    changeAgentInbox,
    addAgentInbox,
    ignoreThread,
    sendHumanResponse,
    fetchThreads,
    fetchSingleThread,
  };

  return ( 
    /*
    ThreadProvider(지금 이 함수임) 가 app/layout.tsx에 정의되어있는데, 
    그 하위 컴포넌트(children) 들이 contextValue에 접근가능해지게 해주는 코드임 (ThreadsContext.Provider로 children을 감싸야함)
    추가적으로 contextValue에 접근하려면, useContext를 사용하면 되는데 이걸 밑에있는 useThreadsContext라는 함수로 미리 정의해 둔것. 
    에러처리하려고한듯. (각 하위 컴포넌트는 useThreadsContext or React.useContext(ThreadsContext)를 실행시켜야 접근할수있음)
    */ 
    <ThreadsContext.Provider value={contextValue}>
      {children}
    </ThreadsContext.Provider>
  ); 
}

export function useThreadsContext<
  T extends Record<string, any> = Record<string, any>,
>() {
   // ######## 전역 데이터를 저장하는 역할을 하는 Thread 저장소를 가져오는 함수 (데이터로는 함수, 변수, 등등 존재)
  const context = React.useContext(ThreadsContext) as ThreadContentType<T>;
  if (context === undefined) {
    throw new Error("useThreadsContext must be used within a ThreadsProvider");
  }
  return context;
}
