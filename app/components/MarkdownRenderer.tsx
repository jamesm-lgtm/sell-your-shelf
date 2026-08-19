'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * The reading surface for every blog post.
 *
 * Long-form is the one place on this site where the text is the object
 * rather than a cover, so the body sets at 17px — a step above UI prose —
 * on the same Literata/Archivo pairing as the rest of the system. It used
 * to run on Georgia and Tailwind greys, a second design system that only
 * the blog spoke.
 */
export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => (
          <h2 className="sy-h2" style={{ fontSize: 27, margin: '44px 0 14px' }}>
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="sy-h3" style={{ margin: '32px 0 10px' }}>
            {children}
          </h3>
        ),
        p: ({ children }) => <p className="sy-body">{children}</p>,
        img: ({ src, alt }) => (
          <img
            src={src}
            alt={alt}
            style={{
              width: '100%',
              display: 'block',
              margin: '28px 0',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-rule)',
            }}
          />
        ),
        ul: ({ children }) => <ul className="sy-body sy-list">{children}</ul>,
        ol: ({ children }) => (
          <ol className="sy-body sy-list" style={{ listStyle: 'decimal' }}>
            {children}
          </ol>
        ),
        li: ({ children }) => <li style={{ marginBottom: 7 }}>{children}</li>,
        a: ({ href, children }) => (
          <a href={href} className="sy-body-link">
            {children}
          </a>
        ),
        strong: ({ children }) => (
          <strong style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{children}</strong>
        ),
        blockquote: ({ children }) => (
          <blockquote
            style={{
              paddingLeft: 22,
              margin: '28px 0',
              borderLeft: '2px solid var(--color-accent)',
              color: 'var(--color-ink-soft)',
              fontStyle: 'italic',
            }}
          >
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          // Wide tables scroll inside their own box rather than pushing the
          // page sideways — the reading column is only 680px.
          <div
            style={{
              overflowX: 'auto',
              margin: '28px 0',
              border: '1px solid var(--color-rule)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <table style={{ width: '100%', fontSize: 15, borderCollapse: 'collapse' }}>
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead style={{ background: 'var(--color-paper-warm)' }}>{children}</thead>
        ),
        th: ({ children }) => (
          <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink)' }}>
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td style={{ padding: '12px 16px', color: 'var(--color-ink-soft)', borderTop: '1px solid var(--color-rule)' }}>
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
