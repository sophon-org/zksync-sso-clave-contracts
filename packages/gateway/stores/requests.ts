import { mapping as requestsMapping } from "@matterlabs/zksync-account/client-gateway";
import type {
  MethodCategory,
  Method,
  MessageID,
  RPCRequestMessage,
  RPCResponseMessageSuccessful,
} from "@matterlabs/zksync-account";
import { communicator } from "@/utils/communicator";

type Request = {
  id: MessageID;
  type: "rpc-request";
  // request: RPCRequest;
  request: any;
};

export const useRequestsStore = defineStore("requests", () => {
  const { appMeta } = useAppMeta();

  const request = ref<Request | undefined>();
  const requestType = computed<MethodCategory | undefined>(() => {
    const method = request.value?.request.action.method;
    if (!method) return undefined;
    return Object.entries(requestsMapping).find(([_category, methods]) =>
      methods.includes(method as Method),
    )?.[0];
  });
  const requestChain = computed(() => {
    const chainId = request.value?.request.chainId;
    return supportedChains.find((chain) => chain.id === chainId);
  });

  communicator
    .onMessage<RPCRequestMessage>((message) => "content" in message)
    .then(async (message) => {
      if (message.content.action.method === "eth_requestAccounts") {
        appMeta.value = message.content.action.params.metadata;
      }
      request.value = {
        id: message.id,
        type: "rpc-request",
        request: message.content as RPCRequest,
      };
    });

  const { inProgress: responseInProgress, execute: respond } = useAsync(
    async (
      responder: () =>
        | RPCResponseMessageSuccessful["content"]
        | Promise<RPCResponseMessageSuccessful["content"]>,
    ) => {
      if (!request.value) throw new Error("No request to confirm");

      communicator.postMessage<RPCResponseMessageSuccessful>({
        requestId: request.value.id,
        id: crypto.randomUUID(),
        timestamp: new Date(),
        content: await responder(),
      });
      communicator.disconnect();
    },
  );

  const deny = () => {
    communicator.disconnect();
  };

  return {
    request: computed(() => request.value),
    requestType,
    responseInProgress,
    requestChain,
    respond,
    deny,
  };
});
