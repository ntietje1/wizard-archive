import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { useState } from 'react'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { publicFaqs, publicSite } from '~/features/landing/content/public-site'

export function FaqSection({ showTitle = true }: { showTitle?: boolean }) {
  const [openItem, setOpenItem] = useState<string | null>(null)

  return (
    <section id="faq" className="py-24">
      <LandingContainer className="flex flex-col items-center">
        {showTitle ? (
          <h2 className="mb-12 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Frequently asked questions
          </h2>
        ) : null}
        <div className="w-full max-w-[700px]">
          {publicFaqs.map((faq, i) => (
            <div key={faq.q} className="border-b border-border/20">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-4 py-4 text-left"
                onClick={() => setOpenItem(openItem === `faq-${i}` ? null : `faq-${i}`)}
                aria-expanded={openItem === `faq-${i}`}
                aria-controls={`faq-panel-${i}`}
              >
                <span className="text-sm font-medium text-foreground">{faq.q}</span>
                {openItem === `faq-${i}` ? (
                  <ChevronUpIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDownIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
              {openItem === `faq-${i}` ? (
                <div id={`faq-panel-${i}`} className="pb-4">
                  <p className="leading-relaxed text-muted-foreground">{faq.a}</p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <p className="text-sm text-muted-foreground">Have another question?</p>
          <a
            href={`mailto:${publicSite.supportEmail}`}
            className="mt-2 inline-block text-base font-medium text-foreground hover:text-primary underline"
          >
            {publicSite.supportEmail}
          </a>
        </div>
      </LandingContainer>
    </section>
  )
}
