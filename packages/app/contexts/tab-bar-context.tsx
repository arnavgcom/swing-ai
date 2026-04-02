import React, { createContext, useContext, useRef, useCallback } from "react";
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

type TabBarContextType = {
  /** Animated value: 0 = visible, 1 = hidden */
  translateY: Animated.Value;
  /** Attach to any ScrollView's onScroll */
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Force-show the tab bar (e.g. on tab press) */
  show: () => void;
};

const TabBarContext = createContext<TabBarContextType | null>(null);

const HIDE_THRESHOLD = 12; // px of downward scroll before hiding

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastOffsetY = useRef(0);
  const isHidden = useRef(false);

  const animateTo = useCallback(
    (toValue: number) => {
      Animated.spring(translateY, {
        toValue,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    },
    [translateY],
  );

  const show = useCallback(() => {
    if (isHidden.current) {
      isHidden.current = false;
      animateTo(0);
    }
  }, [animateTo]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const delta = currentY - lastOffsetY.current;
      lastOffsetY.current = currentY;

      // Near the top — always show
      if (currentY < 60) {
        if (isHidden.current) {
          isHidden.current = false;
          animateTo(0);
        }
        return;
      }

      if (delta > HIDE_THRESHOLD && !isHidden.current) {
        isHidden.current = true;
        animateTo(1);
      } else if (delta < -HIDE_THRESHOLD && isHidden.current) {
        isHidden.current = false;
        animateTo(0);
      }
    },
    [animateTo],
  );

  const value = React.useMemo(
    () => ({ translateY, handleScroll, show }),
    [translateY, handleScroll, show],
  );

  return <TabBarContext.Provider value={value}>{children}</TabBarContext.Provider>;
}

export function useTabBar() {
  const ctx = useContext(TabBarContext);
  if (!ctx) throw new Error("useTabBar must be inside TabBarProvider");
  return ctx;
}

export function useTabBarSafe() {
  return useContext(TabBarContext);
}
