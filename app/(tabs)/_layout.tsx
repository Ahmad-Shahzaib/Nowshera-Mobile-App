// import CustomTabBar from '@/components/CustomTabBar'
// import TopBar from '@/components/TopBar'

import CustomTabBar from '@/components/tabbar/CustomTabBar'
import { TabProvider } from '@/context/TabContext'
import { Tabs, useRouter, useSegments } from 'expo-router'
import React, { useCallback } from 'react'
import { View } from 'react-native'

export default function TabLayout() {
  const router = useRouter()
  const segments = useSegments()

  // Check if we're currently on the profile or social screen
  const currentScreen = segments[segments.length - 1]
  // const isProfileScreen = currentScreen === 'profile'

  // Create stable tabBar render function
  const renderTabBar = useCallback((props: any) => {
    return <>
    <CustomTabBar {...props} />
    </>
  }, [])

  return (
    <TabProvider>
      <View style={{ flex: 1, paddingBottom: 20 }}>
        {/* Only show TopBar when not on profile or social screen */}
        {/* {!isSocialScreen && (
          <TopBar
            onMessagePress={handleMessagePress}
            onNotificationPress={handleNotificationPress}
            onProfilePress={handleProfilePress}
          />
        )} */}
        <Tabs
          tabBar={renderTabBar}
          screenOptions={{
            headerShown: false
          }}
        >
          <Tabs.Screen
            name="customer"
            options={{ headerShown: false, title: 'Customers' }}
          />

          <Tabs.Screen
            name="invoice"
            options={{ headerShown: false, title: 'Invoice' }}
          />

          
          <Tabs.Screen
            name="logout"
            options={{ headerShown: false, title: 'Logout' }}
          />

          {/* <Tabs.Screen
            name="ledger"
            options={{ headerShown: false, title: 'Ledger' }}
          /> */}

          {/* <Tabs.Screen
            name="payments"
            options={{ headerShown: false, title: 'Payments' }}
          /> */}

          <Tabs.Screen
            name="index"
            options={{
              headerShown: false,
              // Hide from bottom tabs
              tabBarButton: () => null,
            }}
          />
          
        </Tabs>
      </View>
    </TabProvider>
  )
}
