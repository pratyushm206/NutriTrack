import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Camera,
  Dumbbell,
  Gauge,
  Sparkles,
  Target,
  Utensils
} from 'lucide-react';
import NutriTrackLogo from '../components/NutriTrackLogo';
import dashboardScreenshot from '../assets/landing-dashboard-real.png';
import nutriaiScreenshot from '../assets/landing-nutriai-real.png';
import foodEstimateScreenshot from '../assets/landing-food-estimate-real.png';
import exerciseEstimateScreenshot from '../assets/landing-exercise-estimate-real.png';
import profileScreenshot from '../assets/landing-profile-real.png';

const features = [
  {
    icon: Utensils,
    tone: 'green',
    title: 'Food clarity',
    text: 'Log meals in plain language. See calories, protein, carbs, and fat without searching through a database.'
  },
  {
    icon: Dumbbell,
    tone: 'blue',
    title: 'Exercise balance',
    text: 'Track calories burned from walks, gym sessions, and everyday movement. Your net calories update instantly.'
  },
  {
    icon: Bot,
    tone: 'green',
    title: 'NutriAI assistant',
    text: 'Ask what to eat next, how to hit protein, or how your day looks, then get suggestions grounded in your logs.'
  },
  {
    icon: Gauge,
    tone: 'amber',
    title: 'Weekly summary',
    text: 'See your week at a glance: eaten vs burned, protein averages, and days that need a little attention.'
  },
  {
    icon: Camera,
    tone: 'blue',
    title: 'Photo logging',
    text: 'Take a photo of a meal and let AI estimate nutrition. Fast, visual, and useful for everyday home food.'
  },
  {
    icon: Target,
    tone: 'green',
    title: 'Personal targets',
    text: 'TDEE-based calorie targets, protein goals tied to your weight, and progress cards that make status obvious.'
  }
];

const faqs = [
  {
    question: 'Is NutriTrack free to use?',
    answer: 'Yes. NutriTrack is designed as a simple browser-based nutrition dashboard with no premium wall in the core experience.'
  },
  {
    question: 'Does it understand Indian food?',
    answer: 'Yes. You can describe foods like dal, roti, sabzi, biryani, dosa, samosa, paneer, or home-cooked meals naturally.'
  },
  {
    question: 'Do I need to install an app?',
    answer: 'No. NutriTrack runs in your browser on desktop and mobile. Create a profile, set targets, and start logging.'
  },
  {
    question: 'Can I edit AI estimates?',
    answer: 'Yes. Every food estimate can be adjusted before logging, so you stay in control of calories and protein.'
  },
  {
    question: 'Can I track exercise too?',
    answer: 'Yes. Exercise logs estimate calories burned and update your net calorie balance for the day.'
  }
];

const quotes = [
  ['Take care of your body. It is the only place you have to live.', 'Jim Rohn'],
  ['Small meals tracked honestly become big decisions made clearly.', 'NutriTrack'],
  ['Fitness is not about being perfect. It is about being consistent.', 'Unknown'],
  ['Good food is not restriction. It is information, energy, and rhythm.', 'NutriTrack']
];

const footerLinks = {
  Dashboard: '#preview',
  NutriAI: '#how',
  'Weekly summary': '#preview',
  'Food log': '#features',
  'How it works': '#how',
  'TDEE calculator': '#features',
  Feedback: '#faq',
  Changelog: '#preview',
  'About Pratyush': '#about',
  'Privacy first': '#faq',
  Contact: '#cta',
  'For students': '#features'
};

export default function About() {
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    const revealItems = document.querySelectorAll('.landing-reveal');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });

    revealItems.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-page">
      <div className="landing-atmos" aria-hidden="true" />

      <section className="landing-hero landing-container" id="top">
        <div className="landing-hero-copy landing-reveal">
          <Pill>AI nutrition dashboard</Pill>
          <h1 className="landing-hero-title">
            Nutrition tracking for <em>real life.</em>
          </h1>
          <p className="landing-hero-text">
            NutriTrack helps you understand what you eat, how much you burn, and what to do next without turning meals into homework.
          </p>
          <div className="landing-hero-actions">
            <Link to="/signup" className="landing-main-btn">
              Start tracking free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/login" className="landing-text-link">Log in</Link>
          </div>
          <div className="landing-badges">
            <span><strong>AI</strong> meal estimates</span>
            <span><strong>TDEE</strong> targets</span>
            <span><strong>7-day</strong> history</span>
          </div>
        </div>

        <div className="landing-hero-visual landing-reveal" aria-label="NutriTrack dashboard preview">
          <DashboardPreview />
        </div>
      </section>

      <section className="landing-container landing-reveal">
        <div className="landing-stats-strip">
          <Stat value="7" label="Days of history tracking" accent />
          <Stat value="AI" label="Meal assist built in" />
          <Stat value="TDEE" label="Smart calorie targets" />
          <Stat value="1" label="Click to log a meal" accent />
        </div>
      </section>

      <section className="landing-section landing-container" id="features">
        <div className="landing-section-header landing-reveal">
          <Pill>Features</Pill>
          <h2 className="landing-section-title">Everything you need.<br />Nothing you do not.</h2>
          <p className="landing-section-sub">
            NutriTrack is designed around the numbers that actually matter: calories, protein, exercise, weekly rhythm, and practical AI suggestions.
          </p>
        </div>
        <div className="landing-feature-grid landing-reveal">
          {features.map(({ icon: Icon, tone, title, text }) => (
            <article key={title} className="landing-feature-card">
              <div className={`landing-feature-icon landing-feature-${tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-how" id="how">
        <div className="landing-container landing-how-inner">
          <div className="landing-reveal">
            <Pill>How it works</Pill>
            <h2 className="landing-section-title">Three steps.<br />One clean view.</h2>
            <div className="landing-steps">
              <Step number="1" title="Set up your profile" text="Enter your body details and goal. NutriTrack calculates daily calorie and protein targets." />
              <Step number="2" title="Log food and exercise" text="Type a meal, upload a photo, or enter nutrition manually. Add exercise to update net calories." />
              <Step number="3" title="Understand your day" text="Review progress, food logs, macro balance, and NutriAI suggestions in one calm dashboard." />
            </div>
          </div>
          <div className="landing-how-card landing-reveal">
            <div className="landing-how-metrics">
              <MiniMetric value="1,840" label="Calories eaten" tone="green" />
              <MiniMetric value="66g" label="Protein" tone="amber" />
            </div>
            <FoodRow name="Aloo Paratha x2" meta="Carbs 62g - Fat 18g" calories="520 kcal" />
            <FoodRow name="Chicken Curry + Rice" meta="Protein 38g - Fat 14g" calories="680 kcal" />
            <FoodRow name="Sweet Lassi" meta="Carbs 28g - Fat 5g" calories="190 kcal" />
            <div className="landing-ai-note">
              <Sparkles className="h-4 w-4" />
              <p>You still have 52g of protein left. Dal, eggs, tofu, or curd would balance dinner nicely.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-container" id="preview">
        <div className="landing-section-header landing-reveal">
          <Pill>App preview</Pill>
          <h2 className="landing-section-title">Your dashboard,<br />every single day.</h2>
          <p className="landing-section-sub">A readable view of calories, protein, movement, and meal history that feels useful instead of noisy.</p>
        </div>
        <div className="landing-reveal">
          <AppPreview />
        </div>
      </section>

      <section className="landing-quotes landing-container">
        {quotes.map(([quote, author]) => (
          <figure key={quote} className="landing-quote-line landing-reveal">
            <blockquote>"{quote}"</blockquote>
            <figcaption>{author}</figcaption>
          </figure>
        ))}
      </section>

      <section className="landing-about landing-container" id="about">
        <div className="landing-builder-card landing-reveal">
          <span>PM</span>
        </div>
        <div className="landing-reveal">
          <Pill>About the builder</Pill>
          <h2 className="landing-section-title">Built by Pratyush Mishra</h2>
          <p className="landing-about-text">
            NutriTrack started as a personal frustration. Most nutrition apps felt complicated, database-heavy, and not built around everyday Indian food.
          </p>
          <p className="landing-about-text">
            So this became a clean, AI-powered dashboard that understands real meals, gives practical suggestions, and respects your time.
          </p>
          <p className="landing-about-emphasis">If it helps you eat a little more intentionally, it has done its job.</p>
        </div>
      </section>

      <section className="landing-faq" id="faq">
        <div className="landing-container">
          <div className="landing-section-header landing-reveal">
            <Pill>FAQ</Pill>
            <h2 className="landing-section-title">Common questions.</h2>
          </div>
          <div className="landing-faq-list landing-reveal">
            {faqs.map((item, index) => (
              <article key={item.question} className={`landing-faq-item ${openFaq === index ? 'open' : ''}`}>
                <button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)}>
                  {item.question}
                  <span>+</span>
                </button>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta landing-container landing-reveal" id="cta">
        <Pill>Start today - it is free</Pill>
        <h2>Your body keeps the score.<br /><em>Start reading it.</em></h2>
        <p>No app install. No credit card. No overwhelm. Just clarity.</p>
        <div className="landing-cta-actions">
          <Link to="/signup" className="landing-main-btn">Start tracking free <ArrowRight className="h-4 w-4" /></Link>
          <Link to="/login" className="landing-ghost-btn">Log in</Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div>
            <div className="landing-footer-brand">
              <NutriTrackLogo className="landing-footer-logo" />
              <span>NutriTrack</span>
            </div>
            <p>A calm, AI-powered nutrition dashboard for everyday food decisions.</p>
            <strong>Built in India</strong>
          </div>
          <FooterCol title="Product" links={['Dashboard', 'NutriAI', 'Weekly summary', 'Food log']} />
          <FooterCol title="Resources" links={['How it works', 'TDEE calculator', 'Feedback', 'Changelog']} />
          <FooterCol title="Company" links={['About Pratyush', 'Privacy first', 'Contact', 'For students']} />
        </div>
      </footer>
    </div>
  );
}

function Pill({ children }) {
  return <div className="landing-pill">{children}</div>;
}

function Stat({ value, label, accent = false }) {
  return (
    <div className="landing-stat">
      <strong className={accent ? 'accent' : ''}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Step({ number, title, text }) {
  return (
    <div className="landing-step">
      <span>{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

function MiniMetric({ value, label, tone }) {
  return (
    <div className="landing-mini-metric">
      <strong className={tone}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function FoodRow({ name, meta, calories }) {
  return (
    <div className="landing-food-row">
      <div>
        <strong>{name}</strong>
        <span>{meta}</span>
      </div>
      <em>{calories}</em>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="landing-screenshot-stack">
      <figure className="landing-screenshot-card landing-screenshot-main">
        <img src={dashboardScreenshot} alt="NutriTrack dashboard daily summary screen" />
      </figure>
      <div className="landing-float-card landing-float-protein">
        <strong>Daily view</strong>
        <span>Calories, protein, logs, and exercise in one place.</span>
      </div>
      <div className="landing-float-card landing-float-tip">
        <strong>NutriAI</strong>
        <span>Real in-app guidance from your logged day.</span>
      </div>
    </div>
  );
}

function AppPreview() {
  return (
    <div className="landing-preview-gallery">
      <ScreenshotCard src={dashboardScreenshot} title="Dashboard" alt="NutriTrack dashboard with daily calorie and protein summary" wide />
      <ScreenshotCard src={nutriaiScreenshot} title="NutriAI" alt="NutriAI assistant page with nutrition context and chat" />
      <ScreenshotCard src={foodEstimateScreenshot} title="Food estimate" alt="Food nutrition estimate for paneer paratha with butter" />
      <ScreenshotCard src={exerciseEstimateScreenshot} title="Exercise estimate" alt="Exercise estimate with calories and burn breakdown" />
      <ScreenshotCard src={profileScreenshot} title="Profile targets" alt="Nutrition profile, BMI, and macro split target" wide />
    </div>
  );
}

function ScreenshotCard({ src, title, alt, wide = false }) {
  return (
    <figure className={`landing-real-shot ${wide ? 'wide' : ''}`}>
      <img src={src} alt={alt} loading="lazy" />
      <figcaption>{title}</figcaption>
    </figure>
  );
}

function FooterCol({ title, links }) {
  return (
    <div className="landing-footer-col">
      <h3>{title}</h3>
      {links.map(link => <a href={footerLinks[link] || '#top'} key={link}>{link}</a>)}
    </div>
  );
}
