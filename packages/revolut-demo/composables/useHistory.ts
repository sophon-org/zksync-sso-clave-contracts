import { useStorage } from "@vueuse/core";



export interface HistoryData {
  mainAccount: Array<{ icon: string; description: string; amount: string; time: string; }>;
  cryptoAccount: Array<{ icon: string; description: string; amount: string; time: string; }>;
}

export const useHistory = () => {
  const history = useStorage<HistoryData>("history", {
    mainAccount: [
      {description: "OBA topup from J Doe", amount: "+ £2,000.00", time: "4 Oct, 13:32 - OBAGNSGT3OXBB4433", icon: "add"},
    ],
    cryptoAccount: []
  });

  return history;
};
