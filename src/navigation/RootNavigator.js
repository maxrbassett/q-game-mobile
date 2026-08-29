/**
 * Root navigation shell: the deck, the account modal, and the game screens
 * (games list -> game view, and send-round). Set up as a real stack (rather
 * than the web app's floating overlays) so a push notification deep link
 * has somewhere to navigate to later (Phase 5).
 */

import React from "react";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DeckScreen from "../screens/DeckScreen";
import SignInScreen from "../screens/SignInScreen";
import GamesListScreen from "../screens/GamesListScreen";
import GameViewScreen from "../screens/GameViewScreen";
import SendModalScreen from "../screens/SendModalScreen";

const Stack = createNativeStackNavigator();

export default function RootNavigator({ isDark, colors, vibeId, setVibe }) {
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
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
          {({ navigation }) => <DeckScreen colors={colors} navigation={navigation} />}
        </Stack.Screen>
        <Stack.Screen name="SignIn" options={{ presentation: "modal" }}>
          {({ navigation }) => (
            <SignInScreen colors={colors} navigation={navigation} vibeId={vibeId} setVibe={setVibe} />
          )}
        </Stack.Screen>
        <Stack.Screen name="GamesList" options={{ presentation: "modal" }}>
          {({ navigation }) => <GamesListScreen colors={colors} navigation={navigation} />}
        </Stack.Screen>
        <Stack.Screen name="GameView">
          {({ route, navigation }) => <GameViewScreen colors={colors} route={route} navigation={navigation} />}
        </Stack.Screen>
        <Stack.Screen name="SendModal" options={{ presentation: "modal" }}>
          {({ route, navigation }) => <SendModalScreen colors={colors} route={route} navigation={navigation} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
