'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => (
          <h2
            className="text-2xl text-gray-900 mt-10 mb-4 tracking-tight"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-semibold text-gray-900 mt-8 mb-3">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="text-gray-600 leading-relaxed mb-4">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="text-gray-600 leading-relaxed mb-4 ml-5 list-disc space-y-1.5">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="text-gray-600 leading-relaxed mb-4 ml-5 list-decimal space-y-1.5">
            {children}
          </ol>
        ),
        li: ({ children }) => <li>{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            className="underline underline-offset-2 hover:opacity-70 transition-opacity"
            style={{ color: '#2D4A3E' }}
          >
            {children}
          </a>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900">{children}</strong>
        ),
        blockquote: ({ children }) => (
          <blockquote
            className="pl-5 my-6 text-gray-500 italic"
            style={{ borderLeft: '3px solid #2D4A3E' }}
          >
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto mb-6 rounded-lg" style={{ border: '1px solid #E5E3DF' }}>
            <table className="w-full text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead style={{ backgroundColor: '#F0EDE8' }}>{children}</thead>
        ),
        th: ({ children }) => (
          <th className="text-left px-4 py-3 font-semibold text-gray-900">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-3 text-gray-600" style={{ borderTop: '1px solid #E5E3DF' }}>
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}