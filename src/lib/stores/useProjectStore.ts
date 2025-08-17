import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { supabase } from '../supabase/client';
import db from '../indexeddb/indexeddb-manager';

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
  loadProjects: () => Promise<void>
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    persist(
      (set, get) => ({
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
        loadProjects: async () => {
          const { data: user } = await supabase.auth.getUser();
          const isGuestMode = !user;
          if (isGuestMode) {
            const localProjects = await db.documents.toArray();
            // Map Document[] to Project[]
            const mappedProjects = localProjects.map((doc) => ({
              id: doc.id,
              title: doc.title,
              description: '',
              current_word_count: doc.metadata.wordCount,
              target_word_count: 0,
              status: doc.syncStatus,
            }));
            set({ projects: mappedProjects });
          } else {
            const { data: projects, error } = await supabase.from('projects').select('*');
            if (!error) set({ projects });
          }
        },
      }),
      {
        name: 'project-store',
        partialize: (state) => ({ currentProject: state.currentProject }),
      }
    ),
    { name: 'project-store' }
  )
)