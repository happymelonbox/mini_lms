import { useSyncExternalStore } from "react";

// false on the server and during hydration, true afterwards: render client-only output without a hydration mismatch.
export const useMounted = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
