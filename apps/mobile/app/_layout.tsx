import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
  if (!tokenData?.data) return;

  await apiFetch("/api/mobile/push-token", {
    method: "POST",
    body: JSON.stringify({ token: tokenData.data }),
  }).catch(() => {}); // non-fatal
}

function RootGuard() {
  const { token, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!token) {
        router.replace("/login");
      } else {
        registerForPushNotifications().catch(() => {});
      }
    }
  }, [token, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f9f9ff" }}>
        <ActivityIndicator size="large" color="#0058be" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: "#ffffff" }, headerTintColor: "#111c2d" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]" options={{ title: "Trip Detail" }} />
      <Stack.Screen name="card/[id]" options={{ title: "Place Card" }} />
      <Stack.Screen name="cards/[tripId]" options={{ title: "Place Cards" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootGuard />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
