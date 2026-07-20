'use client';

import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import LinkExtension from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';

interface RichTextEditorProps {
  value?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export default function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Task details...',
  className = '',
  minHeight = '240px',
}: RichTextEditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline font-medium hover:text-blue-800 cursor-pointer',
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'notion-task-list space-y-1 my-2',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex items-start gap-2 my-1',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const cleanHtml = editor.isEmpty ? '' : html;
      onChange?.(cleanHtml);
    },
  });

  // Keep internal editor content in sync with external value prop updates
  useEffect(() => {
    if (editor && value !== undefined) {
      const currentHtml = editor.getHTML();
      if (value !== currentHtml && !(editor.isEmpty && value === '')) {
        editor.commands.setContent(value || '');
      }
    }
  }, [value, editor]);

  if (!editor) {
    return <div className="w-full border border-gray-200 rounded-lg p-4 bg-gray-50 text-gray-400 text-sm animate-pulse min-h-[150px]">Loading editor...</div>;
  }

  const setLink = () => {
    if (!linkUrl) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      let formattedUrl = linkUrl;
      if (!/^https?:\/\//i.test(formattedUrl) && !/^mailto:/i.test(formattedUrl)) {
        formattedUrl = 'https://' + formattedUrl;
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: formattedUrl }).run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  };

  const openLinkModal = () => {
    const previousUrl = editor.getAttributes('link').href || '';
    setLinkUrl(previousUrl);
    setShowLinkInput(true);
  };

  return (
    <div className={`w-full border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all ${className}`}>
      {/* Notion / CRM style Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border-b border-gray-200 text-gray-700 text-sm select-none">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 pr-1.5 border-r border-gray-300">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m16-10l-6 6m6-6l-6-6" />
            </svg>
          </button>
        </div>

        {/* Headings */}
        <div className="flex items-center gap-0.5 px-1.5 border-r border-gray-300">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
              editor.isActive('heading', { level: 1 })
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-gray-200 text-gray-700'
            }`}
            title="Heading 1"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
              editor.isActive('heading', { level: 2 })
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-gray-200 text-gray-700'
            }`}
            title="Heading 2"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
              editor.isActive('heading', { level: 3 })
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-gray-200 text-gray-700'
            }`}
            title="Heading 3"
          >
            H3
          </button>
        </div>

        {/* Text Formatting */}
        <div className="flex items-center gap-0.5 px-1.5 border-r border-gray-300">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('bold')
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-gray-200 text-gray-700'
            }`}
            title="Bold (Ctrl+B)"
          >
            <span className="font-bold text-sm leading-none">B</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('italic')
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-gray-200 text-gray-700'
            }`}
            title="Italic (Ctrl+I)"
          >
            <span className="italic font-serif text-sm leading-none">I</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('underline')
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-gray-200 text-gray-700'
            }`}
            title="Underline (Ctrl+U)"
          >
            <span className="underline text-sm leading-none font-medium">U</span>
          </button>
        </div>

        {/* Lists & Task Checklists */}
        <div className="flex items-center gap-0.5 px-1.5 border-r border-gray-300">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('bulletList')
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-gray-200 text-gray-700'
            }`}
            title="Bullet List"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('orderedList')
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-gray-200 text-gray-700'
            }`}
            title="Numbered List"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h13M7 12h13M7 16h13M3 8h.01M3 12h.01M3 16h.01" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('taskList')
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-gray-200 text-gray-700'
            }`}
            title="Task Checklist"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>

        {/* Blocks (Blockquote, Code Block, HR) */}
        <div className="flex items-center gap-0.5 px-1.5 border-r border-gray-300">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('blockquote')
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-gray-200 text-gray-700'
            }`}
            title="Blockquote"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('codeBlock')
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-gray-200 text-gray-700'
            }`}
            title="Code Block"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-700 transition-colors"
            title="Horizontal Divider"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
        </div>

        {/* Link */}
        <div className="flex items-center gap-0.5 pl-1.5">
          <button
            type="button"
            onClick={openLinkModal}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('link')
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-gray-200 text-gray-700'
            }`}
            title="Add or Edit Link"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
          {editor.isActive('link') && (
            <button
              type="button"
              onClick={() => editor.chain().focus().unsetLink().run()}
              className="p-1 text-xs text-red-600 hover:underline ml-1"
              title="Remove Link"
            >
              Unlink
            </button>
          )}
        </div>
      </div>

      {/* Popover Inline Link Input */}
      {showLinkInput && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 border-b border-blue-200">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 px-3 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setLink();
              } else if (e.key === 'Escape') {
                setShowLinkInput(false);
              }
            }}
          />
          <button
            type="button"
            onClick={setLink}
            className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
          >
            Save Link
          </button>
          <button
            type="button"
            onClick={() => setShowLinkInput(false)}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Editor Content Area */}
      <div className="p-4 sm:p-5 cursor-text min-h-[240px]" onClick={() => editor.chain().focus().run()}>
        <EditorContent
          editor={editor}
          style={{ minHeight }}
          className="prose prose-sm max-w-none focus:outline-none tiptap-editor-content"
        />
      </div>
    </div>
  );
}
