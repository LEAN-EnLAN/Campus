import { ClosingCta, CommunityBand, Faq, HowItWorks, LandingFooter } from './closing-sections'
import { FeatureMosaic } from './feature-mosaic'
import { LandingHero, LandingTopbar } from './hero'
import { ProgressShowcase } from './progress-showcase'
import { useLandingMeta } from './use-landing-meta'
import { useReveal } from './use-reveal'

/**
 * The public landing: one idea per section, in the order a visitor asks them.
 * What is it → can I trust it → what does it do → does it feel good → how do I
 * start → who makes it → what about… → go.
 */
export function LandingPage() {
  useLandingMeta()
  const rootRef = useReveal<HTMLDivElement>()

  return (
    <div ref={rootRef} className="campus-landing">
      <LandingTopbar />
      <main>
        <LandingHero />
        <FeatureMosaic />
        <ProgressShowcase />
        <HowItWorks />
        <CommunityBand />
        <Faq />
        <ClosingCta />
      </main>
      <LandingFooter />
    </div>
  )
}
