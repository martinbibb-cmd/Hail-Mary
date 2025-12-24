import { Link } from 'react-router-dom'

export function SpinePlaceholderPage(props: { title: string; subtitle?: string }) {
  return (
    <div className="detail-page">
      <div className="page-header">
        <h1>{props.title}</h1>
        {props.subtitle ? <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>{props.subtitle}</p> : null}
      </div>

      <div className="detail-card">
        <p>This tab is a placeholder in PR #1.</p>
      </div>

      <Link to="/" className="back-link">
        ← Back to Home
      </Link>
    </div>
  )
}

