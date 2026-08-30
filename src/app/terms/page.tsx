import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, FileText, AlertCircle, Info } from 'lucide-react';
import AmbientBackground from '@/components/motion/AmbientBackground';

export const metadata: Metadata = {
  title: 'Terms of Service | Munch',
  description: 'Terms and conditions governing your use of Munch, our companion characters, and decision reflection features.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col relative bg-[#FAF7F2] text-[#2D2A26] dark:bg-slate-950 dark:text-white/90">
      <AmbientBackground />

      {/* Top Navigation */}
      <header className="w-full max-w-4xl mx-auto px-6 py-8 flex items-center justify-between z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-charcoal/70 dark:text-white/70 hover:text-primary-dark transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Munch
        </Link>
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="text-2xl animate-float">🍀</span>
          <span className="font-display text-xl font-bold text-primary-dark dark:text-primary-light">
            Munch
          </span>
        </Link>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-3xl mx-auto px-6 pb-20 z-10 w-full space-y-10">
        
        {/* Title Header */}
        <div className="space-y-3 border-b border-charcoal/10 dark:border-white/10 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary-dark dark:text-primary-light text-xs font-semibold">
            <FileText className="w-3.5 h-3.5" />
            Terms of Service
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">
            Terms of Service
          </h1>
          <p className="text-xs text-charcoal/50 dark:text-white/50">
            Document Status: Pre-Launch Draft (Effective date to be established upon public release)
          </p>
        </div>

        {/* Advisory Banner */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs leading-relaxed space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Important Notice: Nature of AI Companion & Wellness Reflections
          </div>
          <p className="text-amber-900/80 dark:text-amber-200/80">
            Munch is an interactive conversational companion application designed for personal reflection, comfort, and decision-support. <strong>Munch is NOT a licensed healthcare provider, psychotherapist, financial advisor, or emergency service.</strong> If you are experiencing a mental health crisis or emergency, please contact your local emergency services or a crisis helpline immediately.
          </p>
        </div>

        {/* Document Sections */}
        <div className="space-y-8 text-sm leading-relaxed text-charcoal/80 dark:text-white/80">
          
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              1. Acceptance of Terms
            </h2>
            <p>
              By creating an account, accessing, or using Munch (the &quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;) and our <Link href="/privacy" className="text-primary-dark dark:text-primary-light font-semibold underline">Privacy Policy</Link>. If you do not agree to all terms and conditions, you must not use or access the Service.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              2. Description of the Service
            </h2>
            <p>
              Munch is a multi-character conversational companion and decision-reflection platform. The Service includes one-on-one companion chats, multi-mascot interactive discussions (the &quot;Munch Table&quot;), weighted decision exploration, personalized reflections, memory consolidation, and private journaling tools.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              3. Eligibility
            </h2>
            <p>
              You must be at least 13 years of age to use Munch. By using the Service, you represent and warrant that you are 13 years of age or older and possess the legal capacity to agree to these Terms.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              4. User Accounts & Security
            </h2>
            <p>
              To access personalized companion features, you must register for an account using a valid email address or supported authentication provider (such as Google OAuth). You are responsible for maintaining the confidentiality of your credentials and for all activities that occur under your account.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              5. Acceptable Use Policy
            </h2>
            <p>You agree not to use Munch to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Transmit unlawful, abusive, harassing, defamatory, obscene, or sexually explicit content.</li>
              <li>Promote self-harm, suicide, cyberbullying, hate speech, or violence against any person or group.</li>
              <li>Attempt to reverse engineer, decompile, extract source code, or tamper with the cognitive pipeline, prompts, or software.</li>
              <li>Engage in automated scraping, flooding, Denial of Service (DoS) attacks, or excessive rapid requests intended to bypass rate limits or exhaust service quotas.</li>
              <li>Impersonate any person or entity or misrepresent your affiliation.</li>
              <li>Use the Service for unauthorized commercial exploitation or automated decision processing.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              6. User Content & Ownership
            </h2>
            <p>
              You retain all ownership rights in the text, inputs, journal entries, and decisions you submit to Munch (&quot;User Content&quot;). By submitting User Content, you grant the Service a non-exclusive license solely to store, process, and transmit your User Content as necessary to operate and deliver the Service for you, in strict accordance with our <Link href="/privacy" className="text-primary-dark dark:text-primary-light font-semibold underline">Privacy Policy</Link>.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              7. AI-Generated Output & Disclaimers
            </h2>
            <p>
              Munch generates conversational responses, affirmations, observations, and reflections using artificial intelligence models. You acknowledge and agree that:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>AI outputs are generated probabilistically and may occasionally contain inaccuracies, incomplete statements, or unexpected responses.</li>
              <li>AI outputs do not constitute professional, clinical, legal, or financial advice. You remain solely responsible for your choices, actions, and decisions.</li>
              <li>We do not guarantee that AI responses will meet your specific expectations or requirements.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              8. Character & Companion Personas (AI Transparency)
            </h2>
            <p>
              Munch features companion personas (such as Munch, Ollie, Ellie, Pandy, Dobby, Coco, Froggy, Bubbles, and Chicky) crafted with distinct speaking styles, aesthetic expressions, and simulated self-awareness. <strong>These characters are conversational software programs and do not possess human consciousness, sentience, feelings, or moral agency.</strong> They are designed to provide a comforting and engaging reflection experience.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              9. Third-Party AI Providers
            </h2>
            <p>
              To process natural language and generate responses, Munch transmits contextual prompt packages over encrypted HTTPS connections to configured third-party artificial intelligence infrastructure providers, including Google LLC (Google Gemini API), Groq Inc., and OpenRouter. Your use of the Service is subject to the technical availability and operational policies of these providers.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              10. Intellectual Property Rights
            </h2>
            <p>
              All rights, titles, and interests in Munch, including but not limited to the software, user interface design, 3D mascot assets, visual animations, cognitive pipeline architecture, trade names, clover logos, and character designs, are the exclusive intellectual property of the operator of Munch and its licensors.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              11. Service Availability & Modifications
            </h2>
            <p>
              We strive to provide continuous availability, but the Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis. We reserve the right to update, modify, suspend, or discontinue any feature or part of the Service at any time without prior notice or liability.
            </p>
          </section>

          {/* Section 12 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              12. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by applicable law, in no event shall the creators or operators of Munch be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, goodwill, or other intangible losses resulting from (a) your use or inability to use the Service; (b) any reliance placed on AI-generated responses; or (c) unauthorized access to or alteration of your transmissions or data.
            </p>
          </section>

          {/* Section 13 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              13. Account Termination & Deletion
            </h2>
            <p>
              We reserve the right to suspend or terminate access to Munch for users who violate these Terms. Users may request account deletion through the designated contact channel, and verified requests will be processed in accordance with our Privacy Policy.
            </p>
          </section>

          {/* Section 14 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              14. Governing Law & Dispute Resolution
            </h2>
            <p>
              These Terms shall be construed in accordance with applicable governing laws established upon official commercial deployment. In the event of any dispute arising out of or relating to these Terms or the Service, the parties agree to seek amicable resolution prior to initiating formal proceedings.
            </p>
          </section>

          {/* Section 15 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              15. Changes to Terms
            </h2>
            <p>
              We may revise these Terms periodically. Notice of material revisions will be provided through updates to this page or announcements within the application. Continued use of Munch following revisions indicates acceptance of the updated Terms.
            </p>
          </section>

          {/* Section 16 */}
          <section className="space-y-3 border-t border-charcoal/10 dark:border-white/10 pt-6">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              16. Contact Information
            </h2>
            <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-charcoal/10 dark:border-white/10 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-charcoal dark:text-white">
                <Info className="w-4 h-4 text-primary-dark dark:text-primary-light" />
                <span>Contact Channels</span>
              </div>
              <p className="text-charcoal/70 dark:text-white/70">
                Official contact channels (such as a dedicated support inbox or in-app feedback tool) are currently being established for public release. In the interim, inquiries may be directed through the official project repository or deployment contact point.
              </p>
            </div>
          </section>

        </div>

        {/* Bottom Footer navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-8 border-t border-charcoal/10 dark:border-white/10 text-xs text-charcoal/50 dark:text-white/50">
          <p>© {new Date().getFullYear()} Munch. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-primary-dark dark:hover:text-primary-light transition-colors font-medium">
              Privacy Policy
            </Link>
            <Link href="/" className="hover:text-primary-dark dark:hover:text-primary-light transition-colors font-medium">
              Home
            </Link>
          </div>
        </div>

      </main>
    </div>
  );
}
