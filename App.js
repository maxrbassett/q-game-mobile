import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Fraunces_500Medium, Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { DMSans_400Regular, DMSans_500Medium } from "@expo-google-fonts/dm-sans";

import { AppProvider } from "./src/context/AppContext";
import { useTheme } from "./src/theme";
import RootNavigator from "./src/navigation/RootNavigator";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [theme, , colors] = useTheme();
  const [fontsLoaded] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <AppProvider>
        <RootNavigator theme={theme} colors={colors} />
      </AppProvider>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
    </View>
  );
}
