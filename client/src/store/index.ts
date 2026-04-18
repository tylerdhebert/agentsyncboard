import { create } from 'zustand'

export type ActiveTab = 'detail' | 'diff' | 'commits' | 'build'
export type DiffType = 'uncommitted' | 'branch' | 'combined'

type Store = {
  selectedJobId: string | null
  setSelectedJobId: (id: string | null) => void

  codeTheme: string
  setCodeTheme: (theme: string) => void

  activeTab: ActiveTab
  setActiveTab: (tab: ActiveTab) => void

  diffType: DiffType
  setDiffType: (type: DiffType) => void

  sidebarCollapsed: boolean
  toggleSidebar: () => void

  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void

  pendingInputIds: string[]
  addPendingInput: (id: string) => void
  removePendingInput: (id: string) => void

  wsConnected: boolean
  setWsConnected: (connected: boolean) => void
}

export const useStore = create<Store>(set => ({
  selectedJobId: null,
  setSelectedJobId: id => set({ selectedJobId: id }),

  codeTheme: localStorage.getItem('codeTheme') ?? 'github-dark-dimmed',
  setCodeTheme: theme => {
    localStorage.setItem('codeTheme', theme)
    set({ codeTheme: theme })
  },

  activeTab: 'detail',
  setActiveTab: tab => set({ activeTab: tab }),

  diffType: 'branch',
  setDiffType: type => set({ diffType: type }),

  sidebarCollapsed: false,
  toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  settingsOpen: false,
  setSettingsOpen: open => set({ settingsOpen: open }),

  pendingInputIds: [],
  addPendingInput: id => set(state => ({
    pendingInputIds: state.pendingInputIds.includes(id) ? state.pendingInputIds : [...state.pendingInputIds, id],
  })),
  removePendingInput: id => set(state => ({
    pendingInputIds: state.pendingInputIds.filter(entry => entry !== id),
  })),

  wsConnected: false,
  setWsConnected: connected => set({ wsConnected: connected }),
}))
