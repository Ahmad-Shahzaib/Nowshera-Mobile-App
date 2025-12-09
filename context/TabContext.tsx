import React, { createContext, ReactNode, useContext, useState } from 'react'

interface TabContextType {
  socialScrollToTop: () => void
  setSocialScrollToTop: (callback: () => void) => void
}

const TabContext = createContext<TabContextType | undefined>(undefined)

export const TabProvider = ({ children }: { children: ReactNode }) => {
  const [socialScrollToTop, setSocialScrollToTopCallback] = useState<() => void>(() => () => {})

  const setSocialScrollToTop = React.useCallback((callback: () => void) => {
    setSocialScrollToTopCallback(() => callback)
  }, [])

  const value = React.useMemo(() => ({
    socialScrollToTop,
    setSocialScrollToTop
  }), [socialScrollToTop, setSocialScrollToTop])

  return (
    <TabContext.Provider value={value}>
      {children}
    </TabContext.Provider>
  )
}

export const useTabContext = () => {
  const context = useContext(TabContext)
  if (context === undefined) {
    throw new Error('useTabContext must be used within a TabProvider')
  }
  return context
}