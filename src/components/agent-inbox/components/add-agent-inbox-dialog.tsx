import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React from "react";
import { useThreadsContext } from "../contexts/ThreadContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryParams } from "../hooks/use-query-params";
import {
  AGENT_INBOX_GITHUB_README_URL,
  NO_INBOXES_FOUND_PARAM,
} from "../constants";
import { PasswordInput } from "@/components/ui/password-input";

export function AddAgentInboxDialog({
  closeSettingsPopover,
  hideTrigger,
  langchainApiKey,
  handleChangeLangChainApiKey,
}: {
  closeSettingsPopover: () => void;
  hideTrigger?: boolean;
  langchainApiKey?: string;
  handleChangeLangChainApiKey?: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
}) {
  const { searchParams, updateQueryParams } = useQueryParams();
  const { toast } = useToast();
  const { addAgentInbox } = useThreadsContext();
  const [open, setOpen] = React.useState(false);
  const [graphId, setGraphId] = React.useState("");
  const [deploymentUrl, setDeploymentUrl] = React.useState("");
  const [name, setName] = React.useState("");

  const noInboxesFoundParam = searchParams.get(NO_INBOXES_FOUND_PARAM);

  React.useEffect(() => {
    try {
      if (typeof window === "undefined") {
        return;
      }
      if (noInboxesFoundParam === "true") {
        setOpen(true);
      }
    } catch (e) {
      console.error("Error getting/setting no inboxes found param", e);
    }
  }, [noInboxesFoundParam]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => { // submit 함수를 온클릭으로 실행하여 url 상태를 usequeryparams로 갱신
    event.preventDefault();
    addAgentInbox({
      id: uuidv4(),
      graphId,
      deploymentUrl,
      name,
      selected: true,
    });
    toast({
      title: "Success",
      description: "Agent inbox added successfully",
      duration: 3000,
    });
    closeSettingsPopover();
    updateQueryParams(NO_INBOXES_FOUND_PARAM);
    setOpen(false);
  };

  const isDeployedGraph = deploymentUrl.includes("default.us.langgraph.app");
  const showLangChainApiKeyField =
    noInboxesFoundParam === "true" &&
    langchainApiKey !== undefined &&
    handleChangeLangChainApiKey &&
    isDeployedGraph;

  return (
    <Dialog
      open={open}
      onOpenChange={(c) => {
        if (!c) {
          updateQueryParams(NO_INBOXES_FOUND_PARAM);
        }
        setOpen(c);
      }}
    >
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline">Add Inbox</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        {noInboxesFoundParam === "true" ? (
          <DialogHeader>
            <DialogTitle>Welcome to the Agent Inbox!</DialogTitle>
            <DialogDescription>
              <p>To get started, please add an inbox below.</p>
              <p>
                Not sure where to start? Check out our docs
                <a
                  href={AGENT_INBOX_GITHUB_README_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-500 hover:underline ml-1"
                >
                  here
                </a>
                .
              </p>
            </DialogDescription>
          </DialogHeader>
        ) : (
          <DialogHeader>
            <DialogTitle>Add Inbox</DialogTitle>
            <DialogDescription>Add a new agent inbox.</DialogDescription>
          </DialogHeader>
        )}
        <form
          className="flex flex-col items-center justify-center gap-4 py-4 w-full"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-2 items-start justify-start w-full">
            <Label htmlFor="graph-id" className="text-right">
              Assistant/Graph ID <span className="text-red-500">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              This is the ID of the graph (can be the graph name), or assistant
              to fetch threads from, and invoke when actions are taken.
            </p>
            <Input
              id="graph-id"
              placeholder="my_graph"
              className="col-span-3"
              required
              value={graphId}
              onChange={(e) => setGraphId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 items-start justify-start w-full">
            <Label htmlFor="deployment-url" className="text-right">
              Deployment URL <span className="text-red-500">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              This is the URL of your LangGraph deployment. Can be a local, or
              production deployment.
            </p>
            <Input
              id="deployment-url"
              placeholder="https://my-agent.default.us.langgraph.app"
              className="col-span-3"
              required
              value={deploymentUrl}
              onChange={(e) => setDeploymentUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 items-start justify-start w-full">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <p className="text-xs text-muted-foreground">
              Optional name for the inbox. Used in the sidebar.
            </p>
            <Input
              id="name"
              placeholder="My Agent"
              className="col-span-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {showLangChainApiKeyField && (
            <div className="flex flex-col items-start gap-2 w-full">
              <div className="flex flex-col gap-1 w-full items-start">
                <Label htmlFor="langchain-api-key">
                  LangSmith API Key <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  This value is stored in your browser&apos;s local storage and
                  is only used to authenticate requests sent to your LangGraph
                  server.
                </p>
              </div>
              <PasswordInput
                id="langchain-api-key"
                placeholder="lsv2_pt_..."
                className="min-w-full"
                required
                value={langchainApiKey}
                onChange={handleChangeLangChainApiKey}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Button variant="brand" type="submit">
              Submit
            </Button>
            <Button
              variant="outline"
              type="reset"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
