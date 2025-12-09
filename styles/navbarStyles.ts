import { Platform, StyleSheet } from "react-native";
import { Colors, Fonts } from "../constants/theme";

// Theme-safe fallbacks so this file won't break if some theme keys are missing.
const themeLight = (Colors as any)?.light ?? {};
const tint = themeLight.tint ?? "#5B7CFA"; // pleasant modern blue
const background = themeLight.background ?? "rgba(255,255,255,0.95)";
const text = themeLight.text ?? "#111827";
const borderMuted = '#4f4762';
const radius = 16;

const NAVBAR_HEIGHT = 58;

const navbarStyles = StyleSheet.create({
  navbar: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 16,
    height: NAVBAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: background,
    borderRadius: radius,
    paddingHorizontal: 8,
    zIndex: 100,
    // soft top border for subtle separation on patterned backgrounds
    borderTopWidth: 0.5,
    borderTopColor: borderMuted,
    // cross-platform gentle shadow to make the bar float
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
      },
      android: {
        elevation: 14,
      },
    }),
  },

  // Each tab container
  navbarItems: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    height: "100%",
  },

  // When a tab is focused we prepare a subtle lifted state (component will animate)
  navbarItemsFocused: {
    transform: [{ translateY: -6 }],
    // small glow / tint behind focused icon (component can render this)
    // borderTop removed in favor of a floating pill indicator
  },

  // Unfocused tab baseline state
  navbarItemsUnfocused: {
    transform: [{ translateY: 0 }],
  },

  // A small pill indicator that can be positioned under the focused icon
  activeIndicator: {
    position: "absolute",
    height: 4,
    width: 36,
    borderRadius: 8,
    backgroundColor: tint,
    bottom: 10,
    // centered horizontally by the component that renders it
  },

  // Text label under icon
  inicio: {
    fontSize: 14,
    lineHeight: 16,
    color: text,
    fontFamily: (Fonts as any)?.sans ?? "system",
    marginTop: 4,
    textAlign: "center",
  },

  // helper small muted label style (if needed)
  labelMuted: {
    fontSize: 11,
    color: '#8b8698',
    fontFamily: (Fonts as any)?.sans ?? "system",
  },
});

export default navbarStyles;
