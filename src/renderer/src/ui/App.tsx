import { useEffect } from 'react'
import { useApp } from '../store/app'
import { Home } from './Home'
import { Editor } from './Editor'
import { Batch } from './Batch'
import { Wizard } from './Wizard'
import { ExportQueue } from './Export'
import { Toasts } from './common'

export function App(): JSX.Element {
  const { view, init, settings, wizardOpen, setWizardOpen } = useApp()
  useEffect(() => {
    init()
    document.body.classList.add(navigator.platform.toLowerCase().includes('mac') ? 'platform-mac' : 'platform-win')
  }, [])
  if (!settings) return <div className="app" />
  return (
    <div className="app">
      {view === 'home' && <Home />}
      {view === 'editor' && <Editor />}
      {view === 'batch' && <Batch />}
      {wizardOpen && <Wizard onClose={() => setWizardOpen(false)} />}
      <ExportQueue />
      <Toasts />
    </div>
  )
}
