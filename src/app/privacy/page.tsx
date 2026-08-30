import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Shield, Lock, Eye, Cpu, Info } from 'lucide-react';
import AmbientBackground from '@/components/motion/AmbientBackground';

export const metadata: Metadata = {
  title: 'Privacy Policy | Munch',
  description: 'Learn how Munch protects your private reflections, conversations, memories, and personal data.',
};

export default function PrivacyPage() {
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
            <Shield className="w-3.5 h-3.5" />
            Privacy & Data Protection
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs text-charcoal/50 dark:text-white/50">
            Document Status: Pre-Launch Draft (Effective date to be established upon public release)
          </p>
        </div>

        {/* Core Principles Callout */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-charcoal/10 dark:border-white/10 space-y-1.5 shadow-sm">
            <div className="flex items-center gap-2 text-primary-dark dark:text-primary-light font-bold text-xs">
              <Lock className="w-4 h-4" />
              Row Level Security
            </div>
            <p className="text-2xs text-charcoal/70 dark:text-white/70 leading-relaxed">
              Every database table enforces strict database-level RLS policies to ensure total cross-user isolation.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-charcoal/10 dark:border-white/10 space-y-1.5 shadow-sm">
            <div className="flex items-center gap-2 text-primary-dark dark:text-primary-light font-bold text-xs">
              <Cpu className="w-4 h-4" />
              AI Transparency
            </div>
            <p className="text-2xs text-charcoal/70 dark:text-white/70 leading-relaxed">
              Clear disclosure of LLM provider processing (Google Gemini, Groq, OpenRouter) and memory context generation.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-charcoal/10 dark:border-white/10 space-y-1.5 shadow-sm">
            <div className="flex items-center gap-2 text-primary-dark dark:text-primary-light font-bold text-xs">
              <Eye className="w-4 h-4" />
              User Control
            </div>
            <p className="text-2xs text-charcoal/70 dark:text-white/70 leading-relaxed">
              You own your inputs and reflections. You can view, edit, and delete individual journal entries and decisions.
            </p>
          </div>
        </div>

        {/* Document Sections */}
        <div className="space-y-8 text-sm leading-relaxed text-charcoal/80 dark:text-white/80">
          
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              1. Overview & Commitment
            </h2>
            <p>
              At Munch, we believe personal reflection and decision-making require transparency, respect, and rigorous data protection. This Privacy Policy explains what data the application collects, how conversations and memories are processed, how third-party AI providers are utilized, and how your information is safeguarded.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              2. Information You Provide Directly
            </h2>
            <p>When you use Munch, the application collects information that you provide directly, including:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Account Information:</strong> Email address, full name, avatar URL, and authenticated session credentials (managed via Supabase Auth).</li>
              <li><strong>Conversations & Chat Messages:</strong> Text inputs, character prompts, and dialogue submitted during companion chats and Munch Table discussions.</li>
              <li><strong>Decisions & Preferences:</strong> Options, weights, selected choices, category tags, and feedback ratings (e.g., &quot;love&quot;, &quot;okay&quot;, &quot;meh&quot;).</li>
              <li><strong>Private Journal Entries:</strong> Titles, reflection notes, and personal journal entries written in the reflection tool.</li>
              <li><strong>Companion Feedback:</strong> Reactions to companion nicknames and preferred mascot settings.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              3. Information Generated Through Use (Personalization Data)
            </h2>
            <p>To provide personalized and continuous companion interactions, our cognitive system distills and stores:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Conversation Summaries:</strong> High-level summaries, emotional arcs, and discovered interests extracted from past chat sessions.</li>
              <li><strong>Companion Memories:</strong> Distilled key takeaways (such as goals, recurring themes, or personal values) generated to give your companion ongoing context.</li>
              <li><strong>User Beliefs & Observations:</strong> Behavioral and cognitive signals (e.g. decision pacing style, reflection tendencies) used to adjust companion tone.</li>
              <li><strong>Envelope Letters:</strong> Milestone letters and encouragement notes delivered by your companion.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              4. Automatically Collected Technical Data
            </h2>
            <p>
              When you access the application, hosting infrastructure providers automatically collect standard technical metrics:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>HTTP Headers & IP Addresses:</strong> Collected transiently in server access logs for DDoS mitigation, security auditing, and serverless routing.</li>
              <li><strong>Rate-Limiting Tokens:</strong> Hashed user identifiers stored temporarily in Upstash Redis to prevent abuse and brute-force attacks.</li>
              <li><strong>Authentication Cookies:</strong> Secure HTTP-only session cookies managed by Supabase Auth (<code>@supabase/ssr</code>) to maintain login state.</li>
              <li><strong>Local Storage (<code>localStorage</code>):</strong> Non-sensitive client preferences, such as sidebar navigation state (<code>munch_sidebar_collapsed</code>).</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              5. How Conversations & AI Processing Work
            </h2>
            <p>
              When you send a message or request a decision reflection, Munch constructs a structured context package containing:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>The active mascot&apos;s personality guidelines and speaking style.</li>
              <li>A compact selection of recent messages in the active chat.</li>
              <li>Top 2–3 relevant memory snippets or user beliefs relevant to the conversation topic.</li>
              <li>Your current message or decision options.</li>
            </ul>
            <p>
              This package is transmitted via encrypted HTTPS (TLS 1.3) to configured third-party Large Language Model (LLM) APIs to generate the companion&apos;s response.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              6. Third-Party AI Service Providers
            </h2>
            <p>
              Munch utilizes third-party AI infrastructure providers to perform language generation and reflection distillation:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Google Gemini API (Google LLC):</strong> Primary conversational and cognitive reflection engine.</li>
              <li><strong>Groq API (Groq Inc.):</strong> High-speed fallback inference engine.</li>
              <li><strong>OpenRouter API:</strong> Secondary fallback routing infrastructure.</li>
            </ul>
            <div className="p-3 rounded-xl bg-charcoal/5 dark:bg-white/5 border border-charcoal/10 dark:border-white/10 text-xs">
              <strong>Data Usage by AI Providers:</strong> Under standard commercial API terms with our configured providers, API prompts and responses are processed for inference and are not used to train public foundational models.
            </div>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              7. Data Storage & Hosting Architecture
            </h2>
            <p>
              Application data is stored with cloud infrastructure providers:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Supabase (PostgreSQL Database & Auth):</strong> Cloud database infrastructure (with encrypted storage volumes at rest and TLS in transit).</li>
              <li><strong>Vercel Inc.:</strong> Application frontend and serverless edge functions hosting.</li>
              <li><strong>Upstash:</strong> Serverless distributed Redis used exclusively for rate limiting.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              8. Security & Row Level Security (RLS)
            </h2>
            <p>
              We implement comprehensive security controls to protect your private records:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>PostgreSQL Row Level Security (RLS):</strong> Every table in the Munch database (including chats, messages, decisions, memories, beliefs, and journal entries) enforces strict Row Level Security policies. Users can only read, insert, update, or delete their own data.</li>
              <li><strong>Authentication Scoping:</strong> Every API route validates authenticated Supabase session tokens and enforces verified user identity context.</li>
              <li><strong>Rate Limiting & Abuse Prevention:</strong> Sensitive and expensive endpoints are protected with distributed sliding-window rate limiters.</li>
              <li><strong>Encryption:</strong> All data in transit is encrypted using modern TLS (HTTPS). Database volumes and backups are encrypted at rest.</li>
            </ul>
            <p className="text-2xs text-charcoal/60 dark:text-white/60">
              <em>Note: While data is encrypted in transit and at rest with strong access controls, Munch is not an &quot;end-to-end encrypted&quot; messenger (as messages must be processed by server-side AI to generate companion responses).</em>
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              9. Data Retention Policy
            </h2>
            <p>
              Your account profile, chats, memories, and journal reflections are retained while your account remains active. If you delete individual items (such as a specific journal entry or decision), those records are immediately removed from active database tables.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              10. Account Deletion & User Rights
            </h2>
            <p>
              You have the right to request full deletion of your account and associated personal data.
            </p>
            <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-charcoal/10 dark:border-white/10 space-y-2 text-xs">
              <p className="font-bold">Account Deletion Workflow:</p>
              <p className="text-charcoal/70 dark:text-white/70">
                While automated self-service account purging is under development, deletion requests may be submitted through the designated support contact channel. Verified requests will permanently remove the user profile and all cascading records (chats, messages, decisions, memories, and journal entries) from the database.
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              11. User Data Rights
            </h2>
            <p>Depending on your location, you may have statutory rights regarding your personal information:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Access & Portability:</strong> The right to review personal data associated with your account.</li>
              <li><strong>Rectification:</strong> The right to correct inaccurate account information.</li>
              <li><strong>Erasure:</strong> The right to request the deletion of your personal records.</li>
            </ul>
          </section>

          {/* Section 12 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              12. Children&apos;s Privacy
            </h2>
            <p>
              Munch is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided personal data, we will take steps to promptly delete such records.
            </p>
          </section>

          {/* Section 13 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              13. Changes to this Privacy Policy
            </h2>
            <p>
              We may update this Privacy Policy periodically. Notice of material updates will be provided through changes to this page or notices within the application.
            </p>
          </section>

          {/* Section 14 */}
          <section className="space-y-3 border-t border-charcoal/10 dark:border-white/10 pt-6">
            <h2 className="font-display text-xl font-bold text-charcoal dark:text-white">
              14. Contact Information
            </h2>
            <div className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-charcoal/10 dark:border-white/10 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-charcoal dark:text-white">
                <Info className="w-4 h-4 text-primary-dark dark:text-primary-light" />
                <span>Contact Channels</span>
              </div>
              <p className="text-charcoal/70 dark:text-white/70">
                Official privacy and support contact channels are currently being established for public release. In the interim, privacy inquiries may be directed through the official project repository or deployment administrator.
              </p>
            </div>
          </section>

        </div>

        {/* Bottom Footer navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-8 border-t border-charcoal/10 dark:border-white/10 text-xs text-charcoal/50 dark:text-white/50">
          <p>© {new Date().getFullYear()} Munch. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-primary-dark dark:hover:text-primary-light transition-colors font-medium">
              Terms of Service
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
