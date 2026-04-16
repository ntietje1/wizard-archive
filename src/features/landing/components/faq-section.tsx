import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { useState } from 'react'
import { LandingContainer } from '~/features/landing/components/landing-container'

const faqs = [
  {
    q: "What makes the Wizard's Archive different from Obsidian or Notion?",
    a: "Obsidian and Notion are excellent personal knowledge tools, but they're designed for solo use. They don't have real-time collaboration with per-player permissions, map pins, or any concept of a \"campaign\" with shared content. The Wizard's Archive is built from the ground up for TTRPG groups — the DM controls exactly who sees what, and everyone works in the same live space. If you love Obsidian for personal notes, you can keep using it — we import Markdown.",
  },
  {
    q: 'How is this different from LegendKeeper?',
    a: "LegendKeeper is a great worldbuilding tool — built for creators building worlds, with features like nested maps, timelines, and lore wikis. The Wizard's Archive is focused on the live campaign experience. Our sharing works at the individual block level per player (not just page-level secrets), we have a view-as mode so DMs can see exactly what a player sees, and our session tools support the moment your group sits down to play. If your main goal is building a world to showcase, LegendKeeper is strong. If your main goal is running a campaign with your group, that's what we're built for.",
  },
  {
    q: 'How is this different from World Anvil?',
    a: "World Anvil has a large feature set and has been around since 2017. It's powerful, but also complex — steep learning curve, multiple pricing tiers with feature gates, and an interface that can be overwhelming. The Wizard's Archive is intentionally simpler and more modern. One price, one plan, a clean block-based editor, and real-time collaboration built in. No BBCode, no ads, no forced public content.",
  },
  {
    q: 'Do my players need to pay?',
    a: "No. Players join free via an invite link. Only the DM needs a subscription. There's no limit on how many players can join a campaign.",
  },
  {
    q: 'What TTRPG systems does this support?',
    a: "All of them. The Wizard's Archive is fully system-agnostic — it doesn't have built-in rules or character sheets for any specific system. You organize your campaign however you want.",
  },
  {
    q: 'Can I use this for in-person sessions?',
    a: "Absolutely. The Wizard's Archive works for virtual groups, in-person groups, and hybrid groups. In person, players can pull up the shared campaign on their phones or laptops. Virtual groups use it alongside their voice or video tool of choice.",
  },
  {
    q: 'Can I import my existing notes?',
    a: "Yes. Import Markdown files — individual notes or entire folder structures. If your notes are in Obsidian, Chronicler, or any other Markdown-compatible tool, they'll come over cleanly.",
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'You can export all your content as Markdown at any time — individual notes or your entire campaign. Your data is yours.',
  },
  {
    q: 'Is there a mobile app?',
    a: "Not yet. The Wizard's Archive is a web app that works in any modern browser, including mobile browsers. A dedicated mobile app is something we'd like to build in the future.",
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Your campaigns are private by default. Only people you explicitly invite can see anything. No ads, no data selling, no public discoverability.',
  },
]

export function FaqSection() {
  const [openItem, setOpenItem] = useState<string | null>(null)

  return (
    <section className="py-24">
      <LandingContainer className="flex flex-col items-center">
        <h2 className="mb-12 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Frequently asked questions
        </h2>
        <div className="w-full max-w-[700px]">
          {faqs.map((faq, i) => (
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
            href="https://discord.gg/VhfzjsaXTD"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-base font-medium text-foreground hover:text-primary underline"
          >
            Ask in our Discord
          </a>
        </div>
      </LandingContainer>
    </section>
  )
}
