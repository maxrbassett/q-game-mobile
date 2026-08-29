import React, { useCallback } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Fraunces_500Medium, Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { DMSans_400Regular, DMSans_500Medium } from "@expo-google-fonts/dm-sans";

import { AppProvider } from "./src/context/AppContext";
import { useVibe, VIBES } from "./src/theme";
import RootNavigator from "./src/navigation/RootNavigator";
import WelcomeScreen from "./src/screens/WelcomeScreen";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [vibeId, setVibe, colors, vibeReady] = useVibe();
  const [fontsLoaded] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
  });

  const ready = fontsLoaded && vibeReady;

  const onLayoutRootView = useCallback(async () => {
    if (ready) await SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  if (!vibeId) {
    return (
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <WelcomeScreen onPick={setVibe} />
        <StatusBar style="light" />
      </View>
    );
  }

  const isDark = VIBES[vibeId].isDark;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <AppProvider>
        <RootNavigator isDark={isDark} colors={colors} vibeId={vibeId} setVibe={setVibe} />
      </AppProvider>
      <StatusBar style={isDark ? "light" : "dark"} />
    </View>
  );
}
