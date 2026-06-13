import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useWalletStore } from "@wallet/store";
import { adapters } from "@/lib/adapters";

export default function RootLayout() {
  const registerAdapter = useWalletStore((s) => s.registerAdapter);

  useEffect(() => {
    adapters.forEach((adapter) => registerAdapter(adapter));
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#030712" },
          headerTintColor: "#ffffff",
          contentStyle: { backgroundColor: "#030712" },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="setup" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ title: "Wallet", headerShown: true }} />
        <Stack.Screen name="send" options={{ title: "Send", presentation: "modal" }} />
        <Stack.Screen name="receive" options={{ title: "Receive", presentation: "modal" }} />
      </Stack>
    </>
  );
}
