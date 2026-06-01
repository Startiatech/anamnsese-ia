import { LandingNavbar } from '@/components/landing/landing-navbar'
import { HeroSection } from '@/components/landing/hero-section'
import { DemoWidget2 } from '@/components/landing/demo-widget-2'
import { HowItWorks } from '@/components/landing/how-it-works'
import { BenefitsSection } from '@/components/landing/benefits-section'
import { PlansSection } from '@/components/landing/plans-section'
import { CTASection } from '@/components/landing/cta-section'
import { LandingFooter } from '@/components/landing/landing-footer'
import { ScrollToTop } from '@/components/landing/scroll-to-top'

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background bg-gradient-to-br from-[var(--primary)]/[0.14] via-cyan-500/[0.05] to-cyan-500/[0.18]">
      <LandingNavbar />
      <HeroSection />
      <DemoWidget2 />
      <HowItWorks />
      <BenefitsSection />
      <PlansSection />
      <CTASection />
      <LandingFooter />
      <ScrollToTop />
    </div>
  )
}
