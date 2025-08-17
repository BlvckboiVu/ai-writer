import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface Project {
  id: string
  title: string
  description?: string
  current_word_count: number
  target_word_count: number
  status: string
}

interface ProjectState {
  projects: Project[]
  currentProject: Project | null
  loading: boolean
  setProjects: (projects: Project[]) => void
  setCurrentProject: (project: Project | null) => void
  setLoading: (loading: boolean) => void
  addProject: (project: Project) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    persist(
      (set) => ({
        projects: [],
        currentProject: null,
        loading: false,
        setProjects: (projects) => set({ projects }),
        setCurrentProject: (project) => set({ currentProject: project }),
        setLoading: (loading) => set({ loading }),
        addProject: (project) =>
          set((state) => ({ projects: [...state.projects, project] })),
        updateProject: (id, updates) =>
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === id ? { ...p, ...updates } : p
            ),
            currentProject:
              state.currentProject?.id === id
                ? { ...state.currentProject, ...updates }
                : state.currentProject,
          })),
        deleteProject: (id) =>
          set((state) => ({
            projects: state.projects.filter((p) => p.id !== id),
            currentProject:
              state.currentProject?.id === id ? null : state.currentProject,
          })),
      }),
      {
        name: 'project-store',
        partialize: (state) => ({ currentProject: state.currentProject }),
      }
    ),
    { name: 'project-store' }
  )
)