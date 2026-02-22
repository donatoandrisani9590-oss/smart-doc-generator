/**
 * TinyMCE module stubs — these files will be replaced by Tiptap (Phase 6).
 * Stubs prevent build errors from orphaned TinyMCE imports.
 */
declare module 'tinymce' {
  export class Editor {
    getContent(args?: any): string
    setContent(content: string, args?: any): void
    on(name: string, callback: (...args: any[]) => void): void
    off(name: string, callback?: (...args: any[]) => void): void
    destroy(): void
    [key: string]: any
  }
  export default Editor
}

declare module 'tinymce/tinymce' {}
declare module 'tinymce/plugins/lists' {}
declare module 'tinymce/plugins/table' {}
declare module 'tinymce/plugins/image' {}
declare module 'tinymce/plugins/link' {}
declare module 'tinymce/plugins/autoresize' {}
declare module 'tinymce/plugins/searchreplace' {}
declare module 'tinymce/plugins/fullscreen' {}
declare module 'tinymce/plugins/code' {}
declare module 'tinymce/plugins/charmap' {}
declare module 'tinymce/plugins/pagebreak' {}
declare module 'tinymce/plugins/anchor' {}
declare module 'tinymce/plugins/insertdatetime' {}
declare module 'tinymce/plugins/wordcount' {}
declare module 'tinymce/themes/silver' {}
declare module 'tinymce/icons/default' {}
declare module 'tinymce/models/dom' {}

declare module '@tinymce/tinymce-react' {
  import type { ComponentType } from 'react'
  export const Editor: ComponentType<any>
}
