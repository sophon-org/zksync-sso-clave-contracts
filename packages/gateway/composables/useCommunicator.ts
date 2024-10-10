import type { Message, PopupConfigMessage } from "zksync-account/communicator";

const listeners = new Map<(_: MessageEvent) => boolean, { reject: (_: Error) => void }>();

const messageHandler = function (event: MessageEvent) {
  if (event.origin !== origin.value) return;

  listeners.forEach((_, listener) => {
    if (listener(event)) {
      window.removeEventListener("message", listener);
      listeners.delete(listener);
    }
  });
};

const origin = ref<string | null>(null);
const isLocal = ref<boolean>(false); ;
window.addEventListener("message", messageHandler);

export const useCommunicator = () => {
  const setOrigin = (_origin: string, local = false) => {
    if (local) {
      isLocal.value = true;
      origin.value = _origin;
    } else {
      origin.value = (new URLSearchParams(_origin)).get("origin");
    }
  };

  /**
   * Posts a message back to the opener window
   */
  const postMessage = <M extends Message>(message: M) => {
    if (!isLocal.value) {
      if (!window.opener) throw new Error("No opener window found");
      window.opener.postMessage(message, origin);
    }
  };

  /**
   * Waits for a specific message from the opener window
   */
  const onMessage = async <M extends Message>(predicate: (_: Partial<M>) => boolean): Promise<M> => {
    return new Promise((resolve, reject) => {
      const listener = (event: MessageEvent) => {
        const message = event.data as M;
        if (predicate(message)) {
          resolve(message);
          return true;
        }
        return false;
      };

      window.addEventListener("message", listener);
      listeners.set(listener, { reject });
    });
  };

  /**
   * Closes the popup and clears the listeners
   */
  const disconnect = () => {
    listeners.forEach(({ reject }, listener) => {
      window.removeEventListener("message", listener);
      reject(new Error("Request rejected"));
    });
    listeners.clear();
    window.close();
  };

  postMessage<PopupConfigMessage>({
    event: "PopupLoaded",
    id: crypto.randomUUID(),
  });

  onMessage<PopupConfigMessage>(({ event }) => event === "PopupUnload")
    .then(disconnect)
    .catch(() => {});

  window.addEventListener("beforeunload", () => {
    postMessage<PopupConfigMessage>({
      event: "PopupUnload",
      id: crypto.randomUUID(),
    });
  });

  return { setOrigin, onMessage, disconnect, postMessage };
};
