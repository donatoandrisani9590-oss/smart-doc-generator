import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export type ChatMessage = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
};

export type ProjectStep = 'setup' | 'editor' | 'review' | 'export';

interface DocumentProjectState {
    projectId: string | null;
    templateType: string | null;
    formData: Record<string, any>;
    chatHistory: ChatMessage[];
    currentStep: ProjectStep;

    // Actions
    startProject: (templateType?: string) => void;
    setTemplateType: (type: string) => void;
    updateFormData: (data: Record<string, any>) => void;
    addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
    clearChatHistory: () => void;
    setStep: (step: ProjectStep) => void;
    abortProject: () => void;
}

const initialState = {
    projectId: null as string | null,
    templateType: null as string | null,
    formData: {},
    chatHistory: [] as ChatMessage[],
    currentStep: 'setup' as ProjectStep,
};

export const useDocumentProjectStore = create<DocumentProjectState>()(
    persist(
        (set: any) => ({
            ...initialState,

            startProject: (templateType?: string) =>
                set((_state: DocumentProjectState) => ({
                    ...initialState, // reset state for new project
                    projectId: uuidv4(),
                    templateType: templateType || null,
                })),

            setTemplateType: (type: string) => set({ templateType: type }),

            updateFormData: (data: Record<string, any>) =>
                set((state: DocumentProjectState) => ({
                    formData: { ...state.formData, ...data },
                })),

            addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) =>
                set((state: DocumentProjectState) => ({
                    chatHistory: [
                        ...state.chatHistory,
                        {
                            ...message,
                            id: uuidv4(),
                            timestamp: Date.now(),
                        },
                    ],
                })),

            clearChatHistory: () => set({ chatHistory: [] }),

            setStep: (step: ProjectStep) => set({ currentStep: step }),

            abortProject: () => set(initialState),
        }),
        {
            name: 'document-project-storage', // name of the item in the storage (must be unique)
            partialize: (state: DocumentProjectState) => ({
                // What to persist
                projectId: state.projectId,
                templateType: state.templateType,
                formData: state.formData,
                chatHistory: state.chatHistory,
                currentStep: state.currentStep,
            }),
        }
    )
);
