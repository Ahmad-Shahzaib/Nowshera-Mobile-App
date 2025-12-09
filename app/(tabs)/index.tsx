import { Redirect } from "expo-router";
import { StyleSheet } from "react-native";

export default function HomeScreen() {
  // RootLayout handles auth redirects. When this route is reached,
  // forward to the default tab page.
  return <Redirect href="/(tabs)/customer" />;
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
});
