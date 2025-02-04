import { useToast } from "@/hooks/use-toast";
import { useThreadsContext } from "../agent-inbox/contexts/ThreadContext";
import { createClient } from "@/lib/client";
import { Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { END } from "@langchain/langgraph/web";

export function DeleteButton({ threadId }: { threadId: string }) {
    const { toast } = useToast();
    const { agentInboxes, ignoreThread } = useThreadsContext();

    // Helper function to show toast messages
    const showToast = (title: string, description: string, variant: string = "default") => {
        toast({ title, description, variant: variant as "default" | "destructive", duration: 3000 });
    };

    // Create client for API requests
    const getClient = () => {
        const selectedInbox = agentInboxes.find((inbox) => inbox.selected);
        if (!selectedInbox?.deploymentUrl) {
            showToast("Error", "No deployment URL found", "destructive");
            return null;
        }
        return createClient({
            deploymentUrl: selectedInbox.deploymentUrl,
            langchainApiKey: localStorage.getItem("LANGCHAIN_API_KEY") || "",
        });
    };

    // Handle delete action
    const handleDelete = async () => {
        if (!threadId) {
            showToast("Error", "Invalid thread ID", "destructive");
            return;
        }

        const client = getClient();
        if (!client) return;

        await ignoreThread(threadId);

        // Perform deletion and state update in parallel
        const results = await Promise.allSettled([
            client.threads.delete(threadId),
            client.threads.updateState(threadId, { values: null, asNode: END }),
        ]);

        // Check results and show appropriate messages
        const [deleteResult, updateResult] = results;
        if (deleteResult.status === "rejected" || updateResult.status === "rejected") {
            console.error("Error during deletion process", deleteResult, updateResult);
            showToast("Error", "Failed to delete thread", "destructive");
            return;
        }

        showToast("Success", "Thread successfully deleted");
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    onClick={handleDelete}
                    className="text-gray-800 dark:text-gray-200 hover:text-red-500 dark:hover:text-red-500 transition-colors ease-in-out duration-200"
                    aria-label="Delete thread"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </TooltipTrigger>
            <TooltipContent>Delete Thread</TooltipContent>
        </Tooltip>
    );
}

export default DeleteButton;