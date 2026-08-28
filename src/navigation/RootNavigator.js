/**
 * Root navigation shell. Only one screen exists today (Deck), but the stack
 * is set up now so Phase 2 (sign-in) and Phase 3 (games list / game view /
 * send modal) can add routes without restructuring, and so a push
 * notification deep link has somewhere to navigate to later.
 */

import React from "react";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DeckScreen from "../screens/DeckScreen";

const Stack = createNativeStackNavigator();

export default function RootNavigator({ theme, colors }) {
  const navTheme = {
    ...(theme === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme === "dark" ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.bg,
      card: colors.surface,
      text: colors.ink,
      border: colors.border,
      primary: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Deck">
          {() => <DeckScreen colors={colors} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
