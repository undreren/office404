import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useGameStore } from '../game/store'

export type TabId = 'feed' | 'shop' | 'agents' | 'projects' | 'leads'

type TabNavContextValue = {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
  projectIndex: number
  setProjectIndex: (index: number) => void
  shopIndex: number
  setShopIndex: (index: number) => void
  acceptLead: (leadId: string) => void
}

const TabNavContext = createContext<TabNavContextValue | null>(null)

export function TabNavProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabId>('feed')
  const [projectIndex, setProjectIndex] = useState(0)
  const [shopIndex, setShopIndex] = useState(0)
  const storeAcceptLead = useGameStore((s) => s.acceptLead)
  const projectCount = useGameStore((s) => s.projects.length)

  useEffect(() => {
    if (projectCount === 0) {
      setProjectIndex(0)
      return
    }
    setProjectIndex((current) => Math.min(current, projectCount - 1))
  }, [projectCount])

  const acceptLead = useCallback(
    (leadId: string) => {
      const wasOnProjects = activeTab === 'projects'
      const prevCount = useGameStore.getState().projects.length
      storeAcceptLead(leadId)
      const nextCount = useGameStore.getState().projects.length
      if (nextCount > prevCount && !wasOnProjects) {
        setActiveTab('projects')
        setProjectIndex(nextCount - 1)
      }
    },
    [activeTab, storeAcceptLead],
  )

  const value = useMemo(
    () => ({
      activeTab,
      setActiveTab,
      projectIndex,
      setProjectIndex,
      shopIndex,
      setShopIndex,
      acceptLead,
    }),
    [activeTab, projectIndex, shopIndex, acceptLead],
  )

  return <TabNavContext.Provider value={value}>{children}</TabNavContext.Provider>
}

export function useTabNav() {
  const ctx = useContext(TabNavContext)
  if (!ctx) throw new Error('useTabNav must be used within TabNavProvider')
  return ctx
}
