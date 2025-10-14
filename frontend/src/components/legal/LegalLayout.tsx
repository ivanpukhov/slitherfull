import { ReactNode, useEffect } from 'react'

import '../../styles/legal.css'

type LegalLayoutProps = {
  title: string
  effectiveDate: string
  children: ReactNode
}

type LegalSectionProps = {
  title: string
  children: ReactNode
}

export function LegalLayout({ title, effectiveDate, children }: LegalLayoutProps) {
  useEffect(() => {
    if (typeof document === 'undefined') return

    const { classList } = document.body
    classList.add('legal-page-body')

    return () => {
      classList.remove('legal-page-body')
    }
  }, [])

  return (
    <div className="legal-page">
      <header className="legal-page__header">
        <h1>{title}</h1>
        <p>Effective date: {effectiveDate}</p>
      </header>
      {children}
    </div>
  )
}

export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section className="legal-page__section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}
