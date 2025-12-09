import DogIcon from '@/assets/icons/dog.svg';
import HandsIcon from '@/assets/icons/hands.svg';
import HomeIcon from '@/assets/icons/home.svg';
import PawIcon from '@/assets/icons/paw.svg';
import StoreIcon from '@/assets/icons/store.svg';
import { Colors } from "@/constants/theme";
import { useTabContext } from '@/context/TabContext';
import navbarStyles from '@/styles/navbarStyles';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSegments } from 'expo-router';
import React from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
// Global render counter
let renderCount = 0;

const iconMap = {
  inicio: HomeIcon,
  servicios: StoreIcon,
  social: DogIcon,
  adopta: PawIcon,
  donaciones: HandsIcon,
};

// Memoized tab item component with a small animated lift and indicator
const TabItem = React.memo(({ 
  route, 
  isFocused, 
  label, 
  onPress, 
  onLongPress, 
  options 
}: {
  route: any;
  isFocused: boolean;
  label: string | any;
  onPress: () => void;
  onLongPress: () => void;
  options: any;
}) => {
  const IconComponent = iconMap[route.name as keyof typeof iconMap];

  const tint = (Colors as any)?.light?.tint ?? '#5B7CFA';
  const defaultIcon = (Colors as any)?.light?.tabIconDefault ?? '#8b8698';
  const activeColor = isFocused ? tint : defaultIcon;

  const anim = React.useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: isFocused ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [isFocused, anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={options.tabBarAccessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
      style={navbarStyles.navbarItems}
    >
      <Animated.View style={{ transform: [{ translateY }, { scale }], alignItems: 'center', width: '100%' }}>
        {IconComponent && (
          <View style={{ width: 28, height: 28 }}>
            <IconComponent width={28} height={28} color={activeColor} />
          </View>
        )}
        <Text style={[navbarStyles.inicio, { color: activeColor }]}> 
          {typeof label === 'string' ? label : route.name}
        </Text>

        {/* Active indicator pill (visible when focused). Opacity is tied to animation. */}
        {/* <Animated.View style={[navbarStyles.activeIndicator, { opacity: anim }]} /> */}
      </Animated.View>
    </TouchableOpacity>
  );
});

TabItem.displayName = 'TabItem';

// Use a debounce to prevent rapid re-renders
let lastRenderTime = 0;
const RENDER_DEBOUNCE = 50; // 50ms debounce

const CustomTabBar = React.memo(({ state, descriptors, navigation }: BottomTabBarProps) => {
  renderCount++;
  const timestamp = new Date().toISOString().split('T')[1];
  
  const { socialScrollToTop } = useTabContext();
  const segments = useSegments();
  
  // Use a stable state to prevent flicker during multiple renders
  const [stableIndex, setStableIndex] = React.useState(state.index);
  
  React.useEffect(() => {
    setStableIndex(state.index);
  }, [state.index]);
  
  // Check if we should hide the tab bar based on current route
  const shouldHideTabBar = React.useMemo(() => {
    const currentSegment = segments[segments.length - 1];
    
    // Hide tab bar for detail pages (routes with [id])
    if (currentSegment && currentSegment.includes('[') && currentSegment.includes(']')) {
      return true;
    }
    
    // Hide tab bar for create pages
    if (currentSegment === 'create') {
      return true;
    }
    
    // Hide tab bar for specific pages (add more as needed)
    const hiddenPages = ['profile', 'settings', 'edit', 'detail'];
    if (currentSegment && hiddenPages.includes(currentSegment)) {
      return true;
    }
    
    // Hide tab bar if we're in nested routes (contains '/')
    if (segments.some(segment => segment.includes('/'))) {
      return true;
    }
    
    return false;
  }, [segments]);
  
  // Filter out routes that should not appear in the tab bar.
  // - 'profile' is hidden by convention
  // - any route whose descriptor.options.tabBarButton() returns null should be hidden
  const visibleRoutes = React.useMemo(() =>
    state.routes.filter((route) => {
      if (route.name === 'profile') return false;
      const options = descriptors[route.key]?.options;

      // If a custom tabBarButton is provided and returns null, treat as hidden.
      if (typeof options?.tabBarButton === 'function') {
        try {
          const maybeElement = options.tabBarButton({} as any);
          if (maybeElement === null) return false;
        } catch (e) {
          // If calling the tabBarButton throws, don't hide by accident.
        }
      }

      // Also hide any nested/child routes that shouldn't render as top-level tabs.
      // Expo Router can include nested routes in the tab navigation state with names
      // like 'customer/create' or dynamic names containing brackets like '[id]'.
      // Treat those as non-tab routes.
      if (typeof route.name === 'string') {
        if (route.name.includes('/') || route.name.includes('[') || route.name.includes(']')) {
          return false;
        }
      }

      return true;
    }),
    [state.routes, descriptors]
  );

  return (
    <View style={[navbarStyles.navbar, shouldHideTabBar && { display: 'none' }]}>
      {visibleRoutes.map((route) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name;

        // Find the original index of this route in the full state
        const originalIndex = React.useMemo(
          () => state.routes.findIndex(r => r.key === route.key),
          [state.routes, route.key]
        );
        const isFocused = stableIndex === originalIndex;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          // Special handling for social tab - scroll to top and refresh if already focused
          if (route.name === 'social' && isFocused) {
            socialScrollToTop();
            return;
          }

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TabItem
            key={route.key}
            route={route}
            isFocused={isFocused}
            label={label}
            onPress={onPress}
            onLongPress={onLongPress}
            options={options}
          />
        );
      })}
    </View>
  );
}, (prevProps, nextProps) => {
  // More precise state comparison - only check what matters for rendering
  const indexEqual = prevProps.state.index === nextProps.state.index;
  const routesLengthEqual = prevProps.state.routes.length === nextProps.state.routes.length;
  const routesEqual = prevProps.state.routes.every((route, i) => 
    route.key === nextProps.state.routes[i]?.key &&
    route.name === nextProps.state.routes[i]?.name
  );
  
  const stateEqual = indexEqual && routesLengthEqual && routesEqual;
  
  // Check if descriptors keys are the same (route configuration)
  const prevDescriptorKeys = Object.keys(prevProps.descriptors).sort();
  const nextDescriptorKeys = Object.keys(nextProps.descriptors).sort();
  const descriptorsEqual = (
    prevDescriptorKeys.length === nextDescriptorKeys.length &&
    prevDescriptorKeys.every((key, i) => key === nextDescriptorKeys[i])
  );
  
  const navigationEqual = prevProps.navigation === nextProps.navigation;
  
  const shouldSkipRender = stateEqual && descriptorsEqual && navigationEqual;
  
  // Keep logs out of production — avoid noisy UI logs that can indicate
  // navigation re-initialization. Developers can enable these temporarily
  // by uncommenting the block below.
  // if (!shouldSkipRender) {
  //   if (!indexEqual) {
  //     console.log(`  state.index: ${prevProps.state.index} -> ${nextProps.state.index}`);
  //   }
  //   if (!routesEqual) {
  //     console.log(`  routes changed`);
  //   }
  //   if (!navigationEqual) {
  //     console.log(`  navigation object changed`);
  //   }
  // }
  
  return shouldSkipRender;
});

CustomTabBar.displayName = 'CustomTabBar';

export default CustomTabBar;
