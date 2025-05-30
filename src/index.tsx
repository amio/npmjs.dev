import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import App from './components/app'

const root = createRoot(document.getElementById('root')!)

root.render(
  <StrictMode>
    <div className="container">
      <div className="header-row">
        <div className="header width-limited">
          <h2>NPM Package Fiddler</h2>
        </div>
      </div>
      <App />
    </div>
  </StrictMode>
)
