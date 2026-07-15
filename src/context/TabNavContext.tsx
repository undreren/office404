import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { acceptLeadMsg } from '../game/messages'
import { useGameDispatchAt, useGameState } from '../runtime/GameRuntime'

export type TabId = 'status' | 'shop' | 'projects' | 'hallucinations'

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
  const [activeTab, setActiveTab] = useState<TabId>('projects')
  const [projectIndex, setProjectIndex] = useState(0)
  const [shopIndex, setShopIndex] = useState(0)
  const { tutorialDone, projects } = useGameState()
  const projectCount = projects.length
  const dispatchAt = useGameDispatchAt()
  const pendingLeadNav = useRef<{ wasOnProjects: boolean; prevCount: number } | null>(null)

  useEffect(() => {
    if (projectCount === 0) {
      setProjectIndex(0)
      return
    }
    setProjectIndex((current) => Math.min(current, projectCount - 1))
  }, [projectCount])

  useEffect(() => {
    if (!tutorialDone && projects.length === 1 && projects[0]?.isTutorial) {
      setActiveTab('projects')
    }
  }, [tutorialDone, projects])

  useEffect(() => {
    const pending = pendingLeadNav.current
    if (!pending) return
    pendingLeadNav.current = null
    if (projectCount > pending.prevCount && !pending.wasOnProjects) {
      setActiveTab('projects')
      setProjectIndex(projectCount - 1)
    }
  }, [projectCount])

  const acceptLead = useCallback(
    (leadId: string) => {
      pendingLeadNav.current = { wasOnProjects: activeTab === 'projects', prevCount: projectCount }
      dispatchAt((at) => acceptLeadMsg(at, leadId))
    },
    [activeTab, dispatchAt, projectCount],
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
