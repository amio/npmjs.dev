import { useState, useEffect } from 'react'
import PlaceholderLoading from 'react-placeholder-loading'
import Markdown from 'marked-react'
import DOMPurify from 'dompurify'

export interface ReadmeProps {
  package: string
}

const QUICK_DEMOS = [
  { name: 'es-toolkit', href: '/es-toolkit' },
  { name: 'marked', href: '/marked' },
  { name: 'yaml', href: '/yaml' },
]

const isWelcomeMode = (packageName: string) => !packageName

let htmlKeyCounter = 0

const markdownRenderer = {
  html(html: string) {
    return (
      <span
        key={`html-${htmlKeyCounter++}`}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
      />
    )
  },
}

export function Readme({ package: packageName }: ReadmeProps) {
  const [markdownContent, setMarkdownContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [showLoading, setShowLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let loadingTimer: ReturnType<typeof setTimeout> | null = null
    let isCancelled = false

    const fetchReadme = async () => {
      if (isWelcomeMode(packageName)) {
        setIsLoading(false)
        setShowLoading(false)
        setError(null)
        setMarkdownContent('')
        return
      }

      setIsLoading(true)
      setShowLoading(false)
      setError(null)
      setMarkdownContent('')

      loadingTimer = setTimeout(() => {
        if (!isCancelled) {
          setShowLoading(true)
        }
      }, 500)

      try {
        const response = await fetch(`https://unpkg.com/${packageName}/readme.md`)

        if (!response.ok) {
          // Try alternative README file names
          const alternatives = ['README.md', 'Readme.md', 'README.MD']
          let found = false

          for (const alt of alternatives) {
            try {
              const altResponse = await fetch(`https://unpkg.com/${packageName}/${alt}`)
              if (altResponse.ok) {
                const content = await altResponse.text()
                setMarkdownContent(content)
                found = true
                break
              }
            } catch {
              // Continue to next alternative
            }
          }

          if (!found) {
            throw new Error(`README not found for package "${packageName}"`)
          }
        } else {
          const content = await response.text()
          setMarkdownContent(content)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch README')
      } finally {
        if (loadingTimer) {
          clearTimeout(loadingTimer)
        }
        if (!isCancelled) {
          setIsLoading(false)
          setShowLoading(false)
        }
      }
    }

    fetchReadme()

    return () => {
      isCancelled = true
      if (loadingTimer) {
        clearTimeout(loadingTimer)
      }
    }
  }, [packageName])

  if (isWelcomeMode(packageName)) {
    return (
      <div className="readme">
        <div className="readme-content readme-welcome-layout">
          <div className="readme-placeholder readme-welcome">
            <h2>Welcome to npmjs:dev</h2>
            <p className="readme-welcome-lead">A playground for npm packages.</p>
            <div className="readme-welcome-mapping" aria-label="URL mapping example">
              <code>npmjs.com/{'{package-name}'}</code>
              <code>npmjs.dev/{'{package-name}'}</code>
            </div>
            <p className="readme-welcome-hint">
              Swap <code>com</code> for <code>dev</code> to open the matching playground.
            </p>
            <p className="readme-welcome-samples">
              Try samples:{' '}
              {QUICK_DEMOS.map((demo, index) => (
                <span key={demo.name}>
                  {index > 0 && ', '}
                  <a href={demo.href}>{demo.name}</a>
                </span>
              ))}
            </p>
            <p className="readme-welcome-source">
              <a href="https://github.com/amio/npmjs.dev">Source on GitHub</a>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="readme">
      <div className="readme-content">
        {isLoading && showLoading && (
          <div className="readme-loading">
            <PlaceholderLoading shape="rect" width="68%" height="1.75rem" />
            <PlaceholderLoading shape="rect" width="100%" height="0.95rem" />
            <PlaceholderLoading shape="rect" width="94%" height="0.95rem" />
            <PlaceholderLoading shape="rect" width="88%" height="0.95rem" />
            <PlaceholderLoading shape="rect" width="76%" height="0.95rem" />
            <PlaceholderLoading shape="rect" width="82%" height="0.95rem" />
          </div>
        )}

        {error && (
          <div className="readme-error">
            <h4>❌ Could not load documentation</h4>
            <p>{error}</p>
            <p>
              <small>
                Try visiting{' '}
                <a href={`https://unpkg.com/${packageName}/`} target="_blank" rel="noopener noreferrer">
                  unpkg.com/{packageName}
                </a>{' '}
                to browse the package files manually.
              </small>
            </p>
          </div>
        )}

        {!isLoading && !error && markdownContent && (
          <div className="markdown-content">
            <Markdown gfm renderer={markdownRenderer}>
              {markdownContent.replace(/<br\s*\/?>/gi, '  \n')}
            </Markdown>
          </div>
        )}

        {!isLoading && !error && !markdownContent && (
          <div className="readme-placeholder">
            <p>No README found for this package.</p>
            <p>
              <small>
                Visit{' '}
                <a href={`https://unpkg.com/${packageName}/`} target="_blank" rel="noopener noreferrer">
                  unpkg.com/{packageName}
                </a>{' '}
                to browse the package files.
              </small>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
