import { useStorage } from "@vueuse/core";

export interface CartData {
  amount: number;
}

export const useCart = () => {
  const cartData = useStorage<CartData>("cart-data", {
    amount: 0
  });

  return cartData;
};
