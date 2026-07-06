import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// AI возвращает ответ в Markdown. Рендерим его в тёплой теме проекта:
// компактная типографика, списки, выделения, таблицы GFM.
const components: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold text-ink">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="my-2 ml-4 list-disc space-y-1 marker:text-faint first:mt-0 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 ml-4 list-decimal space-y-1 marker:text-faint first:mt-0 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  h1: ({ children }) => (
    <h3 className="mb-1 mt-3 text-[15px] font-semibold text-ink first:mt-0">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-1 mt-3 text-[15px] font-semibold text-ink first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mb-1 mt-3 text-sm font-semibold text-ink first:mt-0">
      {children}
    </h4>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-line-strong pl-3 text-muted">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-[0.85em] text-ink">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-panel p-3 text-[13px] leading-relaxed">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-3 border-line" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-line-strong bg-panel px-2 py-1 text-left font-semibold text-ink">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-line-strong px-2 py-1 align-top text-muted">
      {children}
    </td>
  ),
};

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed text-ink">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
