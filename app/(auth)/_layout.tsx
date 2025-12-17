import { Stack } from 'expo-router';

export default function AuthRoutesLayout() {
  // Root layout handles redirect based on persisted auth state.
  // Keep this layout minimal to avoid duplicate router replaces.
  return <Stack screenOptions={{ headerShown: false }} />;
}

