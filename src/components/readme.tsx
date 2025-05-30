import { useState, useEffect } from 'react'
import PlaceholderLoading from 'react-placeholder-loading'
import Markdown from 'marked-react'

export interface ReadmeProps {
  package: string
}

export function Readme({ package: packageName }: ReadmeProps) {
  const [markdownContent, setMarkdownContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchReadme = async () => {
      if (!packageName) return

      setIsLoading(true)
      setError(null)
      setMarkdownContent('')

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
        setIsLoading(false)
      }
    }

    fetchReadme()
  }, [packageName])

  return (
    <div className="readme">
      <div className="readme-content">
        {isLoading && (
          <div className="readme-loading">
            <PlaceholderLoading shape="rect" width="100%" height="3vh" />
            <PlaceholderLoading shape="rect" width="100%" height="3vh" />
            <PlaceholderLoading shape="rect" width="100%" height="3vh" />
            <PlaceholderLoading shape="rect" width="100%" height="24vh" />
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
            <Markdown>{markdownContent}</Markdown>
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
