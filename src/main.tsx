import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
document.documentElement.dataset.theme=localStorage.getItem('ta-theme')==='light'?'light':'dark';import './milestones.css'
import './snapshots.css'
import './interaction.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
