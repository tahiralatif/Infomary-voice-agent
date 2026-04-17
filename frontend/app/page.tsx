'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  FiMic, FiMessageSquare, FiHome, FiShield, FiHeart, FiUsers,
  FiMapPin, FiCheck, FiChevronDown, FiArrowRight, FiPhone, FiMail,
  FiMenu, FiX, FiClock
} from 'react-icons/fi'
import { RiNurseLine } from 'react-icons/ri'
import { MdOutlineLocalHospital, MdOutlineDirectionsCar, MdOutlineVolunteerActivism } from 'react-icons/md'
import { BiBrain } from 'react-icons/bi'
import { HiOutlineHome } from 'react-icons/hi'
import { TbNurse } from 'react-icons/tb'

/* ── Carousel Card Component ── */
type CarouselSlide = { img: string; tag: string; tagColor: string; title: string; desc: string }

function CarouselCard({ slides }: { slides: CarouselSlide[] }) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const next = useCallback(() => setCurrent(c => (c + 1) % slides.length), [slides.length])

  useEffect(() => {
    if (paused) { if (intervalRef.current) clearInterval(intervalRef.current); return }
    intervalRef.current = setInterval(next, 3800)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [paused, next])

  const slide = slides[current]

  return (
    <div
      className="group relative rounded-2xl sm:rounded-3xl overflow-hidden h-56 sm:h-64 lg:h-72 cursor-pointer"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Images — crossfade */}
      {slides.map((s, i) => (
        <Image
          key={s.img}
          src={s.img}
          alt={s.title}
          fill
          className={`object-cover transition-opacity duration-700 ${i === current ? 'opacity-100' : 'opacity-0'}`}
          unoptimized
          priority={i === 0}
        />
      ))}

      {/* Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f2240]/95 via-[#0f2240]/50 to-transparent" />

      {/* Dot indicators */}
      <div className="absolute top-4 right-4 flex gap-1.5 z-10">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`rounded-full transition-all duration-300 ${i === current ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'}`}
          />
        ))}
      </div>

      {/* Content — fades with image */}
      <div className="absolute inset-0 p-5 sm:p-8 flex flex-col justify-end z-10">
        <div
          key={current}
          className="animate-fade-in"
        >
          <span className={`${slide.tagColor} text-white text-xs font-bold px-3 py-1 rounded-full w-fit mb-2 sm:mb-3 inline-block shadow-sm`}>
            {slide.tag}
          </span>
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">{slide.title}</h3>
          <p className="text-white/75 text-xs sm:text-sm leading-relaxed">{slide.desc}</p>
        </div>
        <div className="mt-3 sm:mt-4 flex items-center gap-2 text-blue-300 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          Learn more <FiArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  )
}

const testimonials = [
  { name: 'Margaret T.', location: 'Chicago, IL', text: 'Infomary helped us find the perfect memory care facility for my father within 20 minutes. I was overwhelmed before — now I feel at peace.', avatar: 'MT' },
  { name: 'Robert & Linda K.', location: 'Houston, TX', text: 'We had no idea where to start. The AI asked the right questions and matched us with exactly what my mother needed. Incredible service.', avatar: 'RK' },
  { name: 'Sarah M.', location: 'Phoenix, AZ', text: 'As a nurse, I was skeptical. But Infomary gave genuinely helpful, accurate guidance. I now recommend it to families I work with.', avatar: 'SM' },
]

const faqs = [
  { q: 'Is InfoSenior.care free to use?', a: 'Yes, completely free for families. We are funded by our network of care facilities.' },
  { q: 'How does Infomary find the right care?', a: "Infomary asks about your loved one's needs, location, and budget, then matches you with verified facilities." },
  { q: 'Is my information private?', a: 'Absolutely. We follow HIPAA-ready practices and never sell your personal data.' },
  { q: 'What states do you cover?', a: 'We currently serve families across all 50 US states with a growing network of 10,000+ facilities.' },
]

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send message')
      }
      setSubmitted(true)
      setForm({ name: '', email: '', phone: '', message: '' })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* ── NAVBAR ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md py-3' : 'bg-transparent py-4 md:py-5'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">IS</span>
            </div>
            <span className={`text-lg sm:text-xl font-bold transition-colors ${scrolled ? 'text-[#1e3a5f]' : 'text-white'}`}>
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
            {/* <Link href="/chat" className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${scrolled ? 'text-gray-600 hover:text-blue-600' : 'text-white/90 hover:text-white'}`}>
              Text Chat
            </Link> */}
            <Link href="/chat" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-blue-600/30">
              <span className="flex items-center gap-2"><FiMic className="w-4 h-4" /> Talk to Infomary</span>
            </Link>
            <Link href="/dashboard" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-blue-600/30">
              <span className="flex items-center gap-2">Dashboard</span>
            </Link>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            className={`lg:hidden p-2 rounded-lg transition-colors ${scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/10'}`}
          >
            {menuOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-1 shadow-lg">
            {['Services', 'How It Works', 'About', 'Contact'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`}
                onClick={() => setMenuOpen(false)}
                className="block text-sm text-gray-700 py-3 border-b border-gray-50 hover:text-blue-600 transition-colors">
                {item}
              </a>
            ))}
            <div className="pt-3 flex flex-col gap-2">
              <Link href="/chat" onClick={() => setMenuOpen(false)} className="text-center text-sm font-medium text-gray-600 border border-gray-200 py-3 rounded-lg hover:border-blue-300 transition-colors">
                <span className="flex items-center justify-center gap-2"><FiMessageSquare className="w-4 h-4" /> Text Chat</span>
              </Link>
              <Link href="/voice" onClick={() => setMenuOpen(false)} className="text-center bg-blue-600 text-white text-sm font-semibold py-3 rounded-lg hover:bg-blue-700 transition-colors">
                <span className="flex items-center justify-center gap-2"><FiMic className="w-4 h-4" /> Talk to Infomary</span>
              </Link>
              <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="text-center bg-blue-600 text-white text-sm font-semibold py-3 rounded-lg hover:bg-blue-700 transition-colors">
                <span className="flex items-center justify-center gap-2">Dashboard</span>
              </Link>
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
            fill className="object-cover object-center" unoptimized priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f2240]/95 via-[#1e3a5f]/80 to-[#1e3a5f]/40 lg:to-transparent" />
        </div>

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-20 sm:pt-32 sm:pb-24 grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold px-3 py-1.5 sm:px-4 sm:py-2 rounded-full mb-5 sm:mb-6">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
              AI-Powered Senior Care Navigator
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-5 sm:mb-6">
              Finding the Right Care<br />
              <span className="text-blue-300">Starts with a Conversation</span>
            </h1>
            <p className="text-base sm:text-lg text-white/80 leading-relaxed mb-8 sm:mb-10 max-w-lg">
              {"Infomary guides families through one of life's hardest decisions — with empathy, expertise, and 24/7 availability. No forms. No waiting. Just answers."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8 sm:mb-10">
              <Link href="/voice" className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-4 rounded-xl transition-all shadow-2xl shadow-blue-900/50 hover:-translate-y-0.5 w-full sm:w-auto">
                <FiMic className="text-xl w-5 h-5 shrink-0" />
                <div className="text-left">
                  <div className="text-sm font-bold">Talk to Infomary</div>
                  <div className="text-xs text-blue-200">Voice conversation</div>
                </div>
              </Link>
              <Link href="/chat" className="flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white font-semibold px-6 py-4 rounded-xl transition-all hover:-translate-y-0.5 w-full sm:w-auto">
                <FiMessageSquare className="text-xl w-5 h-5 shrink-0" />
                <div className="text-left">
                  <div className="text-sm font-bold">Chat Instead</div>
                  <div className="text-xs text-white/60">Text conversation</div>
                </div>
              </Link>
            </div>
            <div className="flex flex-wrap gap-4 sm:gap-6">
              {[
                { icon: <FiCheck className="w-4 h-4 text-green-400 shrink-0" />, label: 'No registration needed' },
                { icon: <FiCheck className="w-4 h-4 text-green-400 shrink-0" />, label: 'Free for families' },
                { icon: <FiCheck className="w-4 h-4 text-green-400 shrink-0" />, label: 'Available 24/7' },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-white/70">
                  {t.icon}
                  {t.label}
                </div>
              ))}
            </div>
          </div>

          {/* Floating card — desktop only */}
          <div className="hidden lg:flex justify-end">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 w-80 shadow-2xl">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <RiNurseLine className="w-5 h-5 text-white" />
                </div>
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
                  {"Hello! I'm Infomary. I'm here to help you find the right care for your loved one. What's on your mind today?"}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/voice" className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 rounded-lg text-center transition-colors">
                  <FiMic className="w-3.5 h-3.5" /> Start Voice
                </Link>
                <Link href="/chat" className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold py-2.5 rounded-lg text-center transition-colors">
                  <FiMessageSquare className="w-3.5 h-3.5" /> Start Chat
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-2 text-white/40">
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <div className="w-px h-8 bg-white/20 animate-pulse" />
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="bg-[#1e3a5f] py-8 sm:py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {[
            { value: '500+', label: 'Families Helped', icon: <FiUsers className="w-7 h-7 sm:w-8 sm:h-8 text-blue-300" /> },
            { value: '24/7', label: 'AI Availability', icon: <FiClock className="w-7 h-7 sm:w-8 sm:h-8 text-blue-300" /> },
            { value: '10,000+', label: 'Care Facilities', icon: <MdOutlineLocalHospital className="w-7 h-7 sm:w-8 sm:h-8 text-blue-300" /> },
            { value: '50', label: 'States Covered', icon: <FiMapPin className="w-7 h-7 sm:w-8 sm:h-8 text-blue-300" /> },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3 sm:gap-4">
              {s.icon}
              <div>
                <p className="text-xl sm:text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs sm:text-sm text-blue-300">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 sm:mb-14 lg:mb-16 gap-5">
            <div className="max-w-xl">
              <span className="text-blue-600 text-xs sm:text-sm font-bold uppercase tracking-widest">What We Offer</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#1e3a5f] mt-3 mb-3 sm:mb-4">Comprehensive Senior Care Services</h2>
              <p className="text-gray-500 text-base sm:text-lg">Whatever your loved one needs — we help you find it, understand it, and access it.</p>
            </div>
            <Link href="/voice" className="shrink-0 inline-flex items-center gap-2 border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white font-semibold px-5 sm:px-6 py-3 rounded-xl transition-all text-sm w-fit">
              Find Care Now →
            </Link>
          </div>

          {/* Featured top 2 large carousel cards */}
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <CarouselCard
              slides={[
                { img: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=800&q=85', tag: 'Most Requested', tagColor: 'bg-blue-600', title: 'In-Home Care', desc: 'Personalized daily assistance so your loved one can stay safely and comfortably at home — on their own terms.' },
                { img: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=800&q=85', tag: 'Compassionate', tagColor: 'bg-emerald-600', title: 'Companion Care', desc: 'Meaningful social engagement and emotional support to combat isolation and loneliness.' },
                { img: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&q=85', tag: '24/7 Support', tagColor: 'bg-indigo-600', title: 'Around-the-Clock Care', desc: 'Professional caregivers available day and night to ensure safety and comfort at home.' },
                { img: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=85', tag: 'Post-Hospital', tagColor: 'bg-orange-500', title: 'Recovery Care', desc: 'Skilled nursing and rehabilitation support to help your loved one recover with confidence.' },
              ]}
            />
            <CarouselCard
              slides={[
                { img: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=85', tag: 'Specialized', tagColor: 'bg-violet-600', title: 'Memory Care', desc: "Specialized, compassionate support for Alzheimer's, dementia, and cognitive decline — in a safe, structured environment." },
                { img: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=800&q=85', tag: 'Community Living', tagColor: 'bg-blue-600', title: 'Assisted Living', desc: 'Warm, supervised communities where seniors thrive with 24/7 professional support and social connection.' },
                { img: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=800&q=85', tag: 'Licensed', tagColor: 'bg-teal-600', title: 'Skilled Nursing', desc: 'Licensed medical care, wound management, and post-hospital rehabilitation by certified professionals.' },
                { img: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&q=85', tag: 'Nationwide', tagColor: 'bg-rose-600', title: 'Respite Care', desc: 'Short-term relief for family caregivers — professional care so you can rest and recharge.' },
              ]}
            />
          </div>

          {/* Bottom 4 smaller cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {[
              {
                icon: <TbNurse className="w-5 h-5" />,
                title: 'Skilled Nursing',
                desc: 'Licensed medical care, wound care, and post-hospital rehabilitation.',
                accent: 'bg-blue-600',
                bar: 'bg-blue-600',
              },
              {
                icon: <MdOutlineLocalHospital className="w-5 h-5" />,
                title: 'Assisted Living',
                desc: 'Warm, supervised communities with 24/7 professional support.',
                accent: 'bg-violet-600',
                bar: 'bg-violet-600',
              },
              {
                icon: <MdOutlineVolunteerActivism className="w-5 h-5" />,
                title: 'Companion Care',
                desc: 'Meaningful social engagement to combat isolation and loneliness.',
                accent: 'bg-emerald-600',
                bar: 'bg-emerald-600',
              },
              {
                icon: <MdOutlineDirectionsCar className="w-5 h-5" />,
                title: 'Transportation',
                desc: 'Reliable, safe rides to appointments, errands, and activities.',
                accent: 'bg-orange-500',
                bar: 'bg-orange-500',
              },
            ].map((s, i) => (
              <div key={i} className="group relative bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-xl transition-all duration-300 cursor-default">
                {/* Top accent bar */}
                <div className={`h-1 w-full ${s.bar}`} />
                <div className="p-5 sm:p-6">
                  {/* Icon */}
                  <div className={`${s.accent} w-10 h-10 rounded-xl flex items-center justify-center text-white mb-4 shadow-md`}>
                    {s.icon}
                  </div>
                  <h3 className="font-bold text-[#1e3a5f] text-sm sm:text-base mb-2 group-hover:text-blue-600 transition-colors leading-snug">{s.title}</h3>
                  <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">{s.desc}</p>
                  {/* Bottom arrow */}
                  <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-gray-300 group-hover:text-blue-500 transition-colors">
                    Learn more <FiArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <span className="text-blue-600 text-xs sm:text-sm font-bold uppercase tracking-widest">Simple Process</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1e3a5f] mt-3 mb-4 sm:mb-6">How Infomary Guides You</h2>
            <p className="text-gray-500 text-base sm:text-lg mb-8 sm:mb-10">No confusing directories. No cold calls. Just a warm, intelligent conversation that leads to the right care.</p>
            <div className="space-y-6 sm:space-y-8">
              {[
                { num: '01', title: 'Start a Conversation', desc: 'Talk or type — Infomary listens with empathy and asks the right questions to understand your situation.', color: 'bg-blue-600' },
                { num: '02', title: 'Get Personalized Matches', desc: 'Based on your needs, location, and budget, Infomary recommends the most suitable care options.', color: 'bg-indigo-600' },
                { num: '03', title: 'Connect with Confidence', desc: 'We connect you directly with verified facilities and caregivers — no middlemen, no pressure.', color: 'bg-violet-600' },
              ].map((s, i) => (
                <div key={i} className="flex gap-4 sm:gap-5">
                  <div className={`${s.color} w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg`}>{s.num}</div>
                  <div>
                    <h3 className="font-bold text-[#1e3a5f] mb-1">{s.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 sm:mt-10">
              <Link href="/voice" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 sm:px-7 py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/30 hover:-translate-y-0.5 text-sm sm:text-base">
                {"Try It Now — It's Free →"}
              </Link>
            </div>
          </div>

          <div className="relative mt-8 lg:mt-0">
            <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl">
              <Image
                src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=85"
                alt="Senior care consultation"
                width={800} height={600}
                className="w-full h-64 sm:h-80 lg:h-[500px] object-cover"
                unoptimized
              />
            </div>
            <div className="absolute -bottom-4 sm:-bottom-6 left-4 sm:-left-6 bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-5 border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-sm">✓</div>
                <span className="font-bold text-gray-800 text-sm">Match Found</span>
              </div>
              <p className="text-xs text-gray-500">3 facilities near Chicago, IL</p>
              <p className="text-xs text-blue-600 font-medium mt-1">Memory Care • In-Home Care</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 bg-[#f8faff]">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <span className="text-blue-600 text-xs sm:text-sm font-bold uppercase tracking-widest">Our Mission</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1e3a5f] mt-3 mb-4 sm:mb-6">Built for American Families Navigating Senior Care</h2>
            <p className="text-gray-600 leading-relaxed mb-4 sm:mb-5 text-sm sm:text-base">
              InfoSenior.care was founded on a simple belief — that every family deserves compassionate, expert guidance when searching for senior care. Not a cold directory. Not a sales pitch. A real conversation.
            </p>
            <p className="text-gray-600 leading-relaxed mb-6 sm:mb-8 text-sm sm:text-base">
              Infomary combines the latest AI with deep healthcare knowledge to provide emotionally intelligent, always-available support — completely free for families across all 50 states.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
              {[
                { icon: <FiShield className="w-5 h-5 shrink-0" />, title: 'HIPAA-Ready', desc: 'Your data is always protected' },
                { icon: <FiCheck className="w-5 h-5 shrink-0" />, title: 'Verified Facilities', desc: 'Licensed & background-checked' },
                { icon: <FiHeart className="w-5 h-5 shrink-0" />, title: 'Free for Families', desc: 'No hidden fees, ever' },
                { icon: <FiMapPin className="w-5 h-5 shrink-0" />, title: 'All 50 States', desc: 'Nationwide coverage' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 sm:gap-3 bg-white rounded-xl p-3 sm:p-4 border border-gray-100">
                  <span className="text-blue-600 mt-0.5">{item.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-800 text-xs sm:text-sm">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-4 lg:mt-0">
            <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl">
              <Image
                src="https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=800&q=85"
                alt="Senior with family"
                width={800} height={600}
                className="w-full h-64 sm:h-80 lg:h-[480px] object-cover"
                unoptimized
              />
            </div>
            <div className="absolute -top-4 sm:-top-5 right-4 sm:-right-5 bg-blue-600 text-white rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xl">
              <p className="text-2xl sm:text-3xl font-bold">98%</p>
              <p className="text-blue-200 text-xs mt-1">Family Satisfaction</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-14 lg:mb-16">
            <span className="text-blue-600 text-xs sm:text-sm font-bold uppercase tracking-widest">Testimonials</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1e3a5f] mt-3">Families Trust InfoSenior.care</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-5 sm:p-7 border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="flex gap-1 mb-3 sm:mb-4">
                  {[...Array(5)].map((_, j) => <span key={j} className="text-yellow-400 text-sm">★</span>)}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-5 sm:mb-6 italic">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">{t.avatar}</div>
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
      <section className="relative py-16 sm:py-20 lg:py-24 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0">
          <Image src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1600&q=80" alt="bg" fill className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-[#1e3a5f]/90" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-5">Start the Conversation Today</h2>
          <p className="text-blue-200 text-base sm:text-lg mb-8 sm:mb-10">Thousands of families have found the right care through Infomary. Yours can too — in minutes, not weeks.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <Link href="/voice" className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 sm:px-10 py-4 rounded-xl transition-all shadow-2xl hover:-translate-y-0.5 text-sm">
              <FiMic className="w-4 h-4" /> Start Voice Conversation
            </Link>
            <Link href="/chat" className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold px-8 sm:px-10 py-4 rounded-xl transition-all hover:-translate-y-0.5 text-sm">
              <FiMessageSquare className="w-4 h-4" /> Start Text Chat
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <span className="text-blue-600 text-xs sm:text-sm font-bold uppercase tracking-widest">FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1e3a5f] mt-3">Common Questions</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 text-left hover:bg-gray-50 transition-colors gap-4">
                  <span className="font-semibold text-gray-800 text-sm">{faq.q}</span>
                  <span className={`text-blue-600 text-lg transition-transform shrink-0 ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 sm:px-6 pb-4 sm:pb-5">
                    <p className="text-gray-500 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          <div>
            <span className="text-blue-600 text-xs sm:text-sm font-bold uppercase tracking-widest">Contact Us</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1e3a5f] mt-3 mb-4 sm:mb-5">Get in Touch</h2>
            <p className="text-gray-500 leading-relaxed mb-8 sm:mb-10 text-sm sm:text-base">Whether you have questions, want to list your facility, or need support — our team is here.</p>
            <div className="space-y-5 sm:space-y-6">
              {[
                { icon: <FiMail className="w-5 h-5" />, label: 'Email Us', value: 'hello@infosenior.care', sub: 'We reply within 24 hours' },
                { icon: <FiPhone className="w-5 h-5" />, label: 'Call Us', value: '+1 (800) 555-0199', sub: 'Mon–Fri, 9am–6pm EST' },
                { icon: <FiMapPin className="w-5 h-5" />, label: 'Coverage', value: 'All 50 United States', sub: '10,000+ verified facilities' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 sm:gap-4">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">{item.icon}</div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">{item.label}</p>
                    <p className="font-bold text-gray-800 text-sm sm:text-base">{item.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-gray-100">
            {submitted ? (
              <div className="text-center py-10 sm:py-12">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiCheck className="w-7 h-7 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">Message Received!</h3>
                <p className="text-gray-500 text-sm">We will get back to you within 24 hours.</p>
                <button onClick={() => setSubmitted(false)} className="mt-4 text-xs text-blue-600 hover:underline">
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4 sm:space-y-5">
                <h3 className="text-xl font-bold text-[#1e3a5f] mb-4 sm:mb-6">Send Us a Message</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                {submitError && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    {submitError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-blue-600/30 hover:-translate-y-0.5"
                >
                  {submitting ? 'Sending...' : 'Send Message →'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0f2240] text-white pt-12 sm:pt-16 pb-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 mb-10 sm:mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-white text-sm font-bold">IS</span>
                </div>
                <span className="text-lg sm:text-xl font-bold">InfoSenior<span className="text-blue-400">.care</span></span>
              </div>
              <p className="text-blue-200/70 text-sm leading-relaxed max-w-xs mb-4 sm:mb-5">
                AI-powered senior care navigation for American families. Compassionate, free, and available 24/7.
              </p>
              <p className="text-blue-300/50 text-xs">Not a medical service. For guidance only.</p>
            </div>
            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-blue-400 mb-4 sm:mb-5">Platform</h4>
              <ul className="space-y-2 sm:space-y-3 text-sm text-blue-200/70">
                <li><Link href="/voice" className="hover:text-white transition-colors">Voice Agent</Link></li>
                <li><Link href="/chat" className="hover:text-white transition-colors">Text Agent</Link></li>
                <li><a href="#services" className="hover:text-white transition-colors">Services</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-blue-400 mb-4 sm:mb-5">Company</h4>
              <ul className="space-y-2 sm:space-y-3 text-sm text-blue-200/70">
                <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-blue-300/50 text-xs">© 2026 InfoSenior.care. All rights reserved.</p>
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
