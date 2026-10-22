import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import './styles.css'
import './ui/debug'

createRoot(document.getElementById('root')!).render(<App />)
