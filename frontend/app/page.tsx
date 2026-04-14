'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'

const services = [
  { icon: '🏠', title: 'In-Home Care', desc: 'Personalized daily assistance so your loved one can stay safely at home.' },
  { icon: '🧠', title: 'Memory Care', desc: "Expert support for Alzheimer's, dementia, and cognitive decline." },
  { icon: '🏥', title: 'Assisted Living', desc: 'Warm, supervised communities with 24/7 professional support.' },
  { icon: '💊', title: 'Skilled Nursing', desc: 'Licensed medical care, wound care, and post-hospital rehabilitation.' },
  { icon: '🤝', title: 'Companion Care', desc: 'Meaningful social engagement to combat isolation and loneliness.' },
  { icon: '🚗', title: 'Transportation', desc: 'Reliable, safe rides to appointments, errands, and activities.' },
]

const testimonials = [
  { name: 'Margaret T.', location: 'Chicago, IL', text: 'Infomary helped us find the perfect memory care facility for my father within 20 minutes. I was overwhelmed before — now I feel at peace.', avatar: 'MT' },
  { name: 'Robert & Linda K.', location: 'Houston, TX', text: 'We had no idea where to start. The AI asked the right questions and matched us with exactly what my mother needed. Incredible service.', avatar: 'RK' },
  { name: 'Sarah M.', location: 'Phoenix, AZ', text: 'As a nurse, I was skeptical. But Infomary gave genuinely helpful, accurate guidance. I now recommend it to families I work with.', avatar: 'SM' },
]

const faqs = [
  { q: 'Is InfoSenior.care free to use?', a: 'Yes, completely free for families. We are funded by our network of care facilities.' },
  { q: 'How does Infomary find the right care?', a: 'Infomary asks about your loved one\'s needs, location, and budget, then matches you with verified facilities.' },
  { q: 'Is my information private?', a: 'Absolutely. We follow HIPAA-ready practices and never sell your personal data.' },
  { q: 'What states do you cover?', a: 'We currently serve families across all 50 US states with a growing network of 10,000+ facilities.' },
]

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* ── NAVBAR ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">IS</span>
            </div>
            <span className={`text-xl font-bold transition-colors ${scrolled ? 'text-[#1e3a5f]' : 'text-white'}`}>
              InfoSenior<span className="text-blue-400">.care</span>
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-8">
            {['Services', 'How It Works', 'About', 'Contact'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`}
                className={`text-sm font-medium transition-colors hover:text-blue-400 ${scrolled ? 'text-gray-600' : 'text-white/90'}`}>
                {item}
              </a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <Link href="/chat" className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${scrolled ? 'text-gray-600 hover:text-blue-600' : 'text-white/90 hover:text-white'}`}>
              Text Chat
            </Link>
            <Link href="/voice" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50">
              🎙️ Talk to Infomary
            </Link>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)} className={`lg:hidden p-2 ${scrolled ? 'text-gray-700' : 'text-white'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-1 shadow-lg">
            {['Services', 'How It Works', 'About', 'Contact'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`}
                onClick={() => setMenuOpen(false)}
                className="block text-sm text-gray-700 py-2.5 border-b border-gray-50 hover:text-blue-600 transition-colors">
                {item}
              </a>
            ))}
            <div className="pt-3 flex flex-col gap-2">
              <Link href="/chat" className="text-center text-sm font-medium text-gray-600 border border-gray-200 py-2.5 rounded-lg">Text Chat</Link>
              <Link href="/voice" className="text-center bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-lg">🎙️ Talk to Infomary</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=1600&q=85"
            alt="Caregiver with senior"
            fill className="object-cover" unoptimized priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f2240]/90 via-[#1e3a5f]/75 to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-32 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full mb-6">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              AI-Powered Senior Care Navigator
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-6">
              Finding the Right Care<br />
              <span className="text-blue-300">Starts with a Conversation</span>
            </h1>
            <p className="text-lg text-white/80 leading-relaxed mb-10 max-w-lg">
              Infomary guides families through one of life's hardest decisions — with empathy, expertise, and 24/7 availability. No forms. No waiting. Just answers.
            </p>
            <div className="flex flex-wrap gap-4 mb-10">
              <Link href="/voice" className="group flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 rounded-xl transition-all shadow-2xl shadow-blue-900/50 hover:shadow-blue-600/50 hover:-translate-y-0.5">
                <span className="text-xl">🎙️</span>
                <div className="text-left">
                  <div className="text-sm font-bold">Talk to Infomary</div>
                  <div className="text-xs text-blue-200">Voice conversation</div>
                </div>
              </Link>
              <Link href="/chat" className="group flex items-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white font-semibold px-8 py-4 rounded-xl transition-all hover:-translate-y-0.5">
                <span className="text-xl">💬</span>
                <div className="text-left">
                  <div className="text-sm font-bold">Chat Instead</div>
                  <div className="text-xs text-white/60">Text conversation</div>
                </div>
              </Link>
            </div>
            <div className="flex flex-wrap gap-6">
              {['No registration needed', 'Free for families', 'Available 24/7'].map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-white/70">
                  <svg className="w-4 h-4 text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Floating card */}
          <div className="hidden lg:flex justify-end">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 w-80 shadow-2xl">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-xl">🩺</div>
                <div>
                  <p className="text-white font-semibold text-sm">Infomary</p>
                  <p className="text-white/50 text-xs">AI Care Navigator</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-400 text-xs font-medium">Online</span>
                </div>
              </div>
              <div className="bg-white/10 rounded-xl p-4 mb-3">
                <p className="text-white/90 text-sm leading-relaxed">
                  "Hello! I'm Infomary. I'm here to help you find the right care for your loved one. What's on your mind today?"
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/voice" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 rounded-lg text-center transition-colors">
                  🎙️ Start Voice
                </Link>
                <Link href="/chat" className="flex-1 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold py-2.5 rounded-lg text-center transition-colors">
                  💬 Start Chat
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40">
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <div className="w-px h-8 bg-white/20 animate-pulse" />
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="bg-[#1e3a5f] py-10 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { value: '500+', label: 'Families Helped', icon: '👨‍👩‍👧' },
            { value: '24/7', label: 'AI Availability', icon: '🕐' },
            { value: '10,000+', label: 'Care Facilities', icon: '🏥' },
            { value: '50', label: 'States Covered', icon: '🇺🇸' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="text-3xl">{s.icon}</span>
              <div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-sm text-blue-300">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-16 gap-6">
            <div className="max-w-xl">
              <span className="text-blue-600 text-sm font-bold uppercase tracking-widest">What We Offer</span>
              <h2 className="text-4xl font-bold text-[#1e3a5f] mt-3 mb-4">Comprehensive Senior Care Services</h2>
              <p className="text-gray-500 text-lg">Whatever your loved one needs — we help you find it, understand it, and access it.</p>
            </div>
            <Link href="/voice" className="shrink-0 inline-flex items-center gap-2 border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white font-semibold px-6 py-3 rounded-xl transition-all text-sm">
              Find Care Now →
            </Link>
          </div>

          {/* Featured top 2 large cards */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {[
              {
                title: 'In-Home Care',
                desc: 'Personalized daily assistance so your loved one can stay safely and comfortably at home — on their own terms.',
                img: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=800&q=80',
                tag: 'Most Requested',
                tagColor: 'bg-blue-600',
              },
              {
                title: 'Memory Care',
                desc: "Specialized, compassionate support for Alzheimer's, dementia, and cognitive decline — in a safe, structured environment.",
                img: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=80',
                tag: 'Specialized',
                tagColor: 'bg-violet-600',
              },
            ].map((s, i) => (
              <div key={i} className="group relative rounded-3xl overflow-hidden h-72 cursor-pointer">
                <Image src={s.img} alt={s.title} fill className="object-cover group-hover:scale-105 transition-transform duration-700" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f2240]/90 via-[#0f2240]/40 to-transparent" />
                <div className="absolute inset-0 p-8 flex flex-col justify-end">
                  <span className={`${s.tagColor} text-white text-xs font-bold px-3 py-1 rounded-full w-fit mb-3`}>{s.tag}</span>
                  <h3 className="text-2xl font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-white/70 text-sm leading-relaxed">{s.desc}</p>
                  <div className="mt-4 flex items-center gap-2 text-blue-300 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    Learn more <span>→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom 4 smaller cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: '💊',
                title: 'Skilled Nursing',
                desc: 'Licensed medical care, wound care, and post-hospital rehabilitation.',
                color: 'from-blue-50 to-indigo-50',
                border: 'border-blue-100',
                iconBg: 'bg-blue-100',
              },
              {
                icon: '🏥',
                title: 'Assisted Living',
                desc: 'Warm, supervised communities with 24/7 professional support.',
                color: 'from-violet-50 to-purple-50',
                border: 'border-violet-100',
                iconBg: 'bg-violet-100',
              },
              {
                icon: '🤝',
                title: 'Companion Care',
                desc: 'Meaningful social engagement to combat isolation and loneliness.',
                color: 'from-emerald-50 to-teal-50',
                border: 'border-emerald-100',
                iconBg: 'bg-emerald-100',
              },
              {
                icon: '🚗',
                title: 'Transportation',
                desc: 'Reliable, safe rides to appointments, errands, and activities.',
                color: 'from-orange-50 to-amber-50',
                border: 'border-orange-100',
                iconBg: 'bg-orange-100',
              },
            ].map((s, i) => (
              <div key={i} className={`group bg-gradient-to-br ${s.color} rounded-2xl p-6 border ${s.border} hover:shadow-lg transition-all duration-300 cursor-default`}>
                <div className={`${s.iconBg} w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-5`}>
                  {s.icon}
                </div>
                <h3 className="font-bold text-[#1e3a5f] mb-2 group-hover:text-blue-600 transition-colors">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-blue-600 text-sm font-bold uppercase tracking-widest">Simple Process</span>
            <h2 className="text-4xl font-bold text-[#1e3a5f] mt-3 mb-6">How Infomary Guides You</h2>
            <p className="text-gray-500 text-lg mb-10">No confusing directories. No cold calls. Just a warm, intelligent conversation that leads to the right care.</p>
            <div className="space-y-8">
              {[
                { num: '01', title: 'Start a Conversation', desc: 'Talk or type — Infomary listens with empathy and asks the right questions to understand your situation.', color: 'bg-blue-600' },
                { num: '02', title: 'Get Personalized Matches', desc: 'Based on your needs, location, and budget, Infomary recommends the most suitable care options.', color: 'bg-indigo-600' },
                { num: '03', title: 'Connect with Confidence', desc: 'We connect you directly with verified facilities and caregivers — no middlemen, no pressure.', color: 'bg-violet-600' },
              ].map((s, i) => (
                <div key={i} className="flex gap-5">
                  <div className={`${s.color} w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg`}>{s.num}</div>
                  <div>
                    <h3 className="font-bold text-[#1e3a5f] mb-1">{s.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10">
              <Link href="/voice" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-7 py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/30 hover:-translate-y-0.5">
                Try It Now — It's Free →
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-3xl overflow-hidden shadow-2xl">
              <Image
                src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=85"
                alt="Senior care consultation"
                width={800} height={600}
                className="w-full h-[500px] object-cover"
                unoptimized
              />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-5 border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-sm">✓</div>
                <span className="font-bold text-gray-800 text-sm">Match Found</span>
              </div>
              <p className="text-xs text-gray-500">3 facilities near Chicago, IL</p>
              <p className="text-xs text-blue-600 font-medium mt-1">Memory Care • In-Home Care</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className="py-24 px-6 bg-[#f8faff]">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-blue-600 text-sm font-bold uppercase tracking-widest">Our Mission</span>
            <h2 className="text-4xl font-bold text-[#1e3a5f] mt-3 mb-6">Built for American Families Navigating Senior Care</h2>
            <p className="text-gray-600 leading-relaxed mb-5">
              InfoSenior.care was founded on a simple belief — that every family deserves compassionate, expert guidance when searching for senior care. Not a cold directory. Not a sales pitch. A real conversation.
            </p>
            <p className="text-gray-600 leading-relaxed mb-8">
              Infomary combines the latest AI with deep healthcare knowledge to provide emotionally intelligent, always-available support — completely free for families across all 50 states.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { icon: '🔒', title: 'HIPAA-Ready', desc: 'Your data is always protected' },
                { icon: '✅', title: 'Verified Facilities', desc: 'Licensed & background-checked' },
                { icon: '🆓', title: 'Free for Families', desc: 'No hidden fees, ever' },
                { icon: '🇺🇸', title: 'All 50 States', desc: 'Nationwide coverage' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 bg-white rounded-xl p-4 border border-gray-100">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="rounded-3xl overflow-hidden shadow-2xl">
              <Image
                src="https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=800&q=85"
                alt="Senior with family"
                width={800} height={600}
                className="w-full h-[480px] object-cover"
                unoptimized
              />
            </div>
            <div className="absolute -top-5 -right-5 bg-blue-600 text-white rounded-2xl p-5 shadow-xl">
              <p className="text-3xl font-bold">98%</p>
              <p className="text-blue-200 text-xs mt-1">Family Satisfaction</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-blue-600 text-sm font-bold uppercase tracking-widest">Testimonials</span>
            <h2 className="text-4xl font-bold text-[#1e3a5f] mt-3">Families Trust InfoSenior.care</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-7 border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => <span key={j} className="text-yellow-400 text-sm">★</span>)}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-6 italic">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">{t.avatar}</div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0">
          <Image src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1600&q=80" alt="bg" fill className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-[#1e3a5f]/90" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-5">Start the Conversation Today</h2>
          <p className="text-blue-200 text-lg mb-10">Thousands of families have found the right care through Infomary. Yours can too — in minutes, not weeks.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/voice" className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-10 py-4 rounded-xl transition-all shadow-2xl hover:-translate-y-0.5 text-sm">
              🎙️ Start Voice Conversation
            </Link>
            <Link href="/chat" className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold px-10 py-4 rounded-xl transition-all hover:-translate-y-0.5 text-sm">
              💬 Start Text Chat
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-blue-600 text-sm font-bold uppercase tracking-widest">FAQ</span>
            <h2 className="text-4xl font-bold text-[#1e3a5f] mt-3">Common Questions</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-gray-50 transition-colors">
                  <span className="font-semibold text-gray-800 text-sm">{faq.q}</span>
                  <span className={`text-blue-600 text-lg transition-transform ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5">
                    <p className="text-gray-500 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <span className="text-blue-600 text-sm font-bold uppercase tracking-widest">Contact Us</span>
            <h2 className="text-4xl font-bold text-[#1e3a5f] mt-3 mb-5">Get in Touch</h2>
            <p className="text-gray-500 leading-relaxed mb-10">Whether you have questions, want to list your facility, or need support — our team is here.</p>
            <div className="space-y-6">
              {[
                { icon: '📧', label: 'Email Us', value: 'hello@infosenior.care', sub: 'We reply within 24 hours' },
                { icon: '📞', label: 'Call Us', value: '+1 (800) 555-0199', sub: 'Mon–Fri, 9am–6pm EST' },
                { icon: '📍', label: 'Coverage', value: 'All 50 United States', sub: '10,000+ verified facilities' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-xl shrink-0">{item.icon}</div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">{item.label}</p>
                    <p className="font-bold text-gray-800">{item.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
            {submitted ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
                <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">Message Received!</h3>
                <p className="text-gray-500 text-sm">We will get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true) }} className="space-y-5">
                <h3 className="text-xl font-bold text-[#1e3a5f] mb-6">Send Us a Message</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Full Name</label>
                    <input type="text" required placeholder="John Smith"
                      value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Phone</label>
                    <input type="tel" placeholder="+1 (555) 000-0000"
                      value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Email Address</label>
                  <input type="email" required placeholder="john@example.com"
                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Message</label>
                  <textarea rows={4} required placeholder="How can we help you?"
                    value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all resize-none" />
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-blue-600/30 hover:-translate-y-0.5">
                  Send Message →
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0f2240] text-white pt-16 pb-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">IS</span>
                </div>
                <span className="text-xl font-bold">InfoSenior<span className="text-blue-400">.care</span></span>
              </div>
              <p className="text-blue-200/70 text-sm leading-relaxed max-w-xs mb-5">
                AI-powered senior care navigation for American families. Compassionate, free, and available 24/7.
              </p>
              <p className="text-blue-300/50 text-xs">Not a medical service. For guidance only.</p>
            </div>
            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-blue-400 mb-5">Platform</h4>
              <ul className="space-y-3 text-sm text-blue-200/70">
                <li><Link href="/voice" className="hover:text-white transition-colors">Voice Agent</Link></li>
                <li><Link href="/chat" className="hover:text-white transition-colors">Text Agent</Link></li>
                <li><a href="#services" className="hover:text-white transition-colors">Services</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-blue-400 mb-5">Company</h4>
              <ul className="space-y-3 text-sm text-blue-200/70">
                <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-blue-300/50 text-xs">© 2025 InfoSenior.care. All rights reserved.</p>
            <div className="flex items-center gap-2 text-xs text-blue-300/50">
              <span className="w-2 h-2 bg-green-400 rounded-full" />
              All systems operational
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
