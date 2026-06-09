# Landing Page Redesign Prompt
## Primetek Global Solutions — Full Public Website Rebuild
## Based on: Cal.com design system (white + teal-green adaptation)

---

You are a senior full-stack engineer and UI/UX designer.
Your task is to completely redesign and rebuild the entire
public-facing landing website for Primetek Global Solutions
using the design system specification below.

Read the following existing files before starting:
- src/app/(public)/layout.tsx
- src/app/(public)/page.tsx
- src/app/(public)/about/page.tsx
- src/app/(public)/services/page.tsx
- src/app/(public)/industries/page.tsx
- src/app/(public)/contact/page.tsx
- src/components/layout/Navbar.tsx
- src/components/layout/Footer.tsx
- src/components/sections/Hero.tsx
- src/components/sections/Stats.tsx
- src/components/sections/ServicesOverview.tsx
- src/components/sections/Testimonials.tsx
- src/components/sections/CTASection.tsx
- src/components/sections/FAQSection.tsx
- src/components/sections/InquiryForm.tsx
- src/lib/faq-data.ts
- src/app/globals.css
- tailwind.config.ts
- package.json


═══════════════════════════════════════════════════════════
PAGE TITLES (update metadata on every page)
═══════════════════════════════════════════════════════════

Update the title in the metadata export of every page:

Home page (src/app/(public)/page.tsx):
  title: "Primetek Global Solutions | IT Staffing for US Companies"
  description: "US-based IT staffing firm specializing in Contract,
  C2C, Contract-to-Hire, and Full-Time placement for US companies.
  Roles filled in 3-5 business days."

About page (src/app/(public)/about/page.tsx):
  title: "About Us | US-Based IT Staffing Firm | Primetek Global Solutions"
  description: "Learn about Primetek Global Solutions — a Birmingham,
  Alabama IT staffing firm founded in 2024, focused on placing IT
  professionals with US-based clients."

Services page (src/app/(public)/services/page.tsx):
  title: "IT Staffing Services | Contract, C2C, Full-Time | Primetek Global Solutions"
  description: "Contract Staffing, C2C, Contract-to-Hire, and Full-Time
  IT recruitment for US-based companies. Covering Software Dev,
  Cloud/DevOps, Data Science, Cybersecurity, QA, and ERP."

Industries page (src/app/(public)/industries/page.tsx):
  title: "Industries We Serve | IT, Healthcare, Finance | Primetek Global Solutions"
  description: "Primetek Global Solutions delivers IT staffing across
  Information Technology, Healthcare, and Banking & Finance industries
  in the United States."

Contact page (src/app/(public)/contact/page.tsx):
  title: "Submit a Staffing Requirement | Primetek Global Solutions"
  description: "Submit your IT staffing requirement. We respond within
  24 hours with matched candidates for contract, C2C, and full-time roles."

Privacy page (src/app/(public)/privacy/page.tsx) — NEW:
  title: "Privacy Policy | Primetek Global Solutions"
  description: "Privacy Policy for Primetek Global Solutions LLC.
  Learn how we collect, use, and protect your information."

Terms page (src/app/(public)/terms/page.tsx) — NEW:
  title: "Terms of Service | Primetek Global Solutions"
  description: "Terms of Service for Primetek Global Solutions LLC.
  Governing law: Alabama, USA."

Also update the root layout (src/app/layout.tsx):
  title.default: "Primetek Global Solutions | IT Staffing for US Companies"
  title.template: "%s | Primetek Global Solutions"
  description: "US-based IT staffing firm specializing in Contract,
  C2C, Contract-to-Hire, and Full-Time IT placement for US companies."


═══════════════════════════════════════════════════════════
DESIGN SYSTEM SPECIFICATION
═══════════════════════════════════════════════════════════

This design is inspired by Cal.com's marketing system but
adapted to a white canvas with teal-green as the primary
action color. It is NOT dark-themed. The only dark surface
is the footer.

── COLORS ──

Canvas (page background):    #ffffff
Primary CTA:                 #0f766e  (teal-700)
Primary CTA active/hover:    #0d6460  (teal-800)
Surface card:                #f5f5f5  (light gray cards)
Surface soft:                #f8f9fa  (nav pill bg, dividers)
Surface strong:              #e5e7eb  (hairline borders)
Surface dark (footer ONLY):  #0f172a  (navy — only dark surface)
Surface dark elevated:       #1e293b  (nested cards in footer)
Hairline border:             #e5e7eb
Hairline soft:               #f3f4f6

Ink (headings):              #111111
Body text:                   #374151
Muted text:                  #6b7280
Muted soft (captions):       #898989
On primary (button text):    #ffffff
On dark soft (footer text):  #a1a1aa

Brand accent (links/badges): #14b8a6  (teal-500)
Badge orange:                #fb923c
Badge pink:                  #ec4899
Badge violet:                #8b5cf6
Badge emerald:               #34d399

Success:                     #10b981
Warning:                     #f59e0b
Error:                       #ef4444

── TYPOGRAPHY ──

Font family: Inter for everything.
Display sizes use Inter weight 600 with negative
letter-spacing to approximate Cal Sans character.
Body uses Inter weight 400.

Scale:
Display XL:  64px / 600 / line-height 1.05 / tracking -2px   → Homepage h1
Display LG:  48px / 600 / line-height 1.1  / tracking -1.5px → Section headings
Display MD:  36px / 600 / line-height 1.15 / tracking -1px   → Sub-section heads
Display SM:  28px / 600 / line-height 1.2  / tracking -0.5px → CTA band heads
Title LG:    22px / 600 / line-height 1.3  / tracking -0.3px → Pricing plan names
Title MD:    18px / 600 / line-height 1.4  / tracking 0      → Feature card titles
Title SM:    16px / 600 / line-height 1.4  / tracking 0      → Small card titles
Body MD:     16px / 400 / line-height 1.5  / tracking 0      → Default running text
Body SM:     14px / 400 / line-height 1.5  / tracking 0      → Footer body
Caption:     13px / 500 / line-height 1.4  / tracking 0      → Badge labels
Button:      14px / 600 / line-height 1.0  / tracking 0      → Button labels
Nav link:    14px / 500 / line-height 1.4  / tracking 0      → Top nav items

Rule: Display headings (h1, h2, h3) always use
Inter 600 with negative letter-spacing.
Body, buttons, nav, captions always use Inter 400-600
with zero letter-spacing. Never mix these roles.

── SPACING ──

Base unit: 4px
Section vertical padding: 96px
Card internal padding (feature cards): 32px
Card internal padding (testimonial/product): 24px
Grid gutters: 24px
Footer column gutters: 16px
Max content width: 1200px centered

── BORDER RADIUS ──

Buttons + inputs:    8px
Content cards:       12px
Hero mockup card:    16px
Badges + nav pills:  9999px (pill)
Avatars:             50% (perfect circle)
Small inline items:  6px

── ELEVATION ──

Flat sections: no shadow, no border
Cards: #f5f5f5 background, no shadow needed
Subtle shadow: 0 1px 2px rgba(0,0,0,0.05)
Elevated card: 0 4px 12px rgba(0,0,0,0.08)
Featured pricing tier: #0f172a background (dark surface)
Footer: #0f172a background (only dark surface on page)

── SECTION RHYTHM ──

Pages must alternate surface modes:
white → surface-card → white → surface-card → dark footer
Never two consecutive identical surface backgrounds.


═══════════════════════════════════════════════════════════
COMPANY FACTS (use only these — no invented data)
═══════════════════════════════════════════════════════════

Company: Primetek Global Solutions LLC
Founded: 2024
Location: Birmingham, Alabama, USA
Address: 1680, Unit 2G, 14th Ave S, Birmingham, AL 35205
Phone: +1 (219) 345-6559
Email: hr@primetekglobalsolutions.com
LinkedIn: https://www.linkedin.com/company/primetek-global-solutions-llc

Services: Contract, C2C, Contract-to-Hire, Full-Time Recruitment
Domains: Software Dev, Data Science/AI/ML, Cloud/DevOps,
         Cybersecurity, QA/Test Automation, ERP, Business Analysis
Clients: Fortune 500, mid-size enterprises, government, startups

NO fake stats. NO fake testimonials. NO invented services.

═══════════════════════════════════════════════════════════
PHASE 1 — INSTALL DEPENDENCY
═══════════════════════════════════════════════════════════

Install Radix UI NavigationMenu for the mega menu navbar:
  npm install @radix-ui/react-navigation-menu

This is the only new dependency allowed.

═══════════════════════════════════════════════════════════
PHASE 2 — NAVBAR (complete rebuild)
═══════════════════════════════════════════════════════════

File: src/components/layout/Navbar.tsx

Build a two-panel mega menu navigation using
@radix-ui/react-navigation-menu in Next.js + Tailwind CSS.

BEHAVIOR:
- Hover on a nav item opens the mega menu panel
- Hovering a different nav item switches the panel content
- Mouse leaving the nav area closes the panel
- On mobile (< 768px): collapses to hamburger menu
  that opens a full-screen sheet with accordion items

STRUCTURE:
Fixed top bar, 64px tall, white background (#ffffff),
1px bottom border (#e5e7eb) when scrolled.
Max content width 1200px centered.

Left: Logo (Primetek wordmark + teal dot or icon)
Center: NavigationMenu with these items:
  - Services (has mega menu)
  - Industries (has mega menu)
  - About (direct link → /about)
  - Contact (direct link → /contact)
Right: "Get in Touch" primary teal button → /contact

MEGA MENU PANEL DESIGN:
Full-width dropdown below the nav bar.
White background, 1px hairline border bottom,
shadow: 0 4px 12px rgba(0,0,0,0.08)
Max width 1200px centered, padding 32px.

Two-panel layout inside the dropdown:

LEFT PANEL (~280px wide, fixed):
  - Section title (Display SM, teal color)
  - 2-3 sentence description (Body MD, muted text)
  - CTA button (primary teal) that changes per nav item
  - Right separator line

RIGHT PANEL (fills remaining width):
  Renders dynamic content based on which nav item is hovered.

SERVICES mega menu right panel:
  4 cards in a 2x2 grid:
  1. Contract Staffing — icon + title + 1 line description
  2. C2C Placements — icon + title + 1 line description
  3. Contract-to-Hire — icon + title + 1 line description
  4. Full-Time Recruitment — icon + title + 1 line description
  Each card: white bg, 8px radius, hairline border,
  12px padding, hover: surface-card bg (#f5f5f5)
  Each card links to /services

INDUSTRIES mega menu right panel:
  3 items in a vertical list:
  1. Information Technology → /industries
  2. Healthcare → /industries
  3. Banking & Finance → /industries
  Each item: icon + title + short description
  Hover: surface-card bg

Left panel content for Services:
  Title: "Staffing Services"
  Description: "Contract, C2C, and full-time IT placement
  for US-based companies. Roles filled in 3-5 days."
  CTA: "View All Services" → /services

Left panel content for Industries:
  Title: "Industries We Serve"
  Description: "Active placements in IT, Healthcare,
  and Banking & Finance across the US."
  CTA: "View Industries" → /industries

MOBILE MENU:
- Hamburger button (44x44px touch target)
- Full-screen white sheet slides in from right
- Each nav item expands as accordion
- Services and Industries show their sub-items
- "Get in Touch" button at bottom of sheet
- Close button top-right


═══════════════════════════════════════════════════════════
PHASE 3 — HOME PAGE
═══════════════════════════════════════════════════════════

File: src/app/(public)/page.tsx
Remove: Stats section, Testimonials section

SECTION 1 — HERO (white canvas)
File: src/components/sections/Hero.tsx
Remove GSAP entirely. Use framer-motion only.

Layout: 7/5 grid on desktop, single column on mobile.

LEFT (7 cols):
  Badge pill (teal bg, white text): "US-Based IT Staffing"
  H1 (64px, Inter 600, -2px tracking):
    "IT Staffing for US Companies.
    Contract, C2C, Full-Time."
  Subheadline (Body MD, muted):
    "We place skilled IT professionals with US-based clients
    across contract, C2C, and full-time roles.
    Positions filled in 3-5 business days."
  Two buttons:
    Primary teal: "Submit a Requirement" → /contact
    Secondary (white + hairline): "Our Services" → /services
  Row of tech domain pill badges below buttons:
    Software Dev · Cloud/DevOps · Data Science ·
    Cybersecurity · QA · ERP

RIGHT (5 cols):
  Card (white bg, 16px radius, hairline border, subtle shadow)
  showing a "How It Works" mini-card with 3 numbered steps:
  1. Submit your requirement
  2. We source candidates (3-5 days)
  3. You interview and hire
  Style: clean, minimal, teal accent numbers

SECTION 2 — WHAT WE DO (white canvas)
File: src/components/sections/ServicesOverview.tsx

Section label (Caption, teal): "WHAT WE DO"
H2 (48px, Inter 600, -1.5px tracking): "Four Ways We Place IT Talent"
Body: "Contract, C2C, Contract-to-Hire, and Full-Time
recruitment for US-based IT roles."

4 cards in a 2x2 grid (desktop), 1-col (mobile):
Each card: surface-card bg (#f5f5f5), 12px radius, 32px padding

  1. Contract Staffing
     Icon: Briefcase (teal)
     Title (18px/600): "Contract Staffing"
     Body: "Short-to-mid term IT professionals for
     project-based work. Typical duration: 3-12 months."
     Link: "Learn more →" → /services#staffing

  2. C2C Placements
     Icon: Building2 (teal)
     Title: "C2C (Corp-to-Corp)"
     Body: "Independent contractors through their own entity.
     Ideal for specialized, project-based engagements."
     Link: "Learn more →" → /services#staffing

  3. Contract-to-Hire
     Icon: UserCheck (teal)
     Title: "Contract-to-Hire"
     Body: "Evaluate candidates on the job before committing
     to permanent placement. Reduces hiring risk."
     Link: "Learn more →" → /services#staffing

  4. Full-Time Recruitment
     Icon: Users (teal)
     Title: "Full-Time Recruitment"
     Body: "End-to-end permanent IT hiring. We handle
     sourcing, screening, and shortlisting."
     Link: "Learn more →" → /services#staffing

SECTION 3 — HOW IT WORKS (surface-card #f5f5f5)
New component: src/components/sections/HowItWorks.tsx

Section label (Caption, teal): "THE PROCESS"
H2 (48px, Inter 600, -1.5px tracking): "From Requirement to Hire in Days"

3 steps in a horizontal row (desktop), vertical (mobile):
Each step: white bg card, 12px radius, 24px padding

Step 1:
  Number: "01" (36px, teal, 600)
  Title (18px/600): "Submit Your Requirement"
  Body: "Tell us the role, tech stack, location,
  and timeline via our contact form."

Step 2:
  Number: "02"
  Title: "We Source and Screen"
  Body: "We identify and pre-screen candidates from
  our network. Contract roles: 3-5 days.
  Full-time: 7-10 days."

Step 3:
  Number: "03"
  Title: "You Interview and Hire"
  Body: "Review shortlisted profiles, conduct interviews,
  and make the hire. We handle the paperwork."

Connector lines between steps on desktop (simple
horizontal line with teal dot at each step number).

SECTION 4 — TECH DOMAINS (white canvas)
New component: src/components/sections/TechDomains.tsx

Section label (Caption, teal): "TECHNOLOGY DOMAINS"
H2 (48px, Inter 600, -1.5px tracking): "The Roles We Fill"
Body: "We specialize in placing IT professionals across
these technology domains."

Large pill badges (teal bg, white text, 9999px radius):
  Software Development · Data Science & AI/ML
  Cloud & DevOps · Cybersecurity
  QA & Test Automation · ERP Technologies
  Business Analysis · Project Management

Below the tags, a simple 3-column honest stat row:
  "Founded 2024" · "Birmingham, AL" · "US Clients Only"

SECTION 5 — FAQ (surface-card #f5f5f5)
Keep FAQSection.tsx component structure.
Rewrite src/lib/faq-data.ts with 6 honest questions
(see FAQ DATA section below).

SECTION 6 — CTA BAND (white canvas)
File: src/components/sections/CTASection.tsx

Card: surface-card bg (#f5f5f5), 12px radius,
48px padding, centered, max-width 640px.

H2 (28px, Inter 600, -0.5px tracking): "Have a Role to Fill?"
Body: "Submit your requirement and we'll respond within
24 hours with matched candidates."
Button (primary teal): "Submit a Requirement" → /contact


═══════════════════════════════════════════════════════════
PHASE 4 — ABOUT PAGE
═══════════════════════════════════════════════════════════

File: src/app/(public)/about/page.tsx

HERO (dark navy #0f172a):
  Badge: "Company Overview"
  H1: "About Primetek Global Solutions"
  Body: "A US-based IT staffing firm founded in 2024,
  focused on connecting skilled IT professionals with
  US companies across contract, C2C, and full-time roles."

SECTION — WHO WE ARE (white canvas):
  2-column grid: text left, card right.
  Left: honest story — new company, focused approach,
  US-only market, IT-only specialization.
  Right: "Company At a Glance" card (surface-card):
    Founded: 2024
    Headquarters: Birmingham, AL
    Industry: IT Staffing & Recruiting
    Market: United States Only

SECTION — OUR APPROACH (surface-card #f5f5f5):
  H2: "How We Work"
  3 cards horizontal:
  1. IT Only — "We specialize in IT staffing exclusively.
     No generalist recruiting."
  2. US Market Only — "We serve US-based clients only,
     with deep understanding of US hiring."
  3. Speed — "Contract roles in 3-5 days.
     Full-time in 7-10 days."

SECTION — MISSION & VISION (white canvas):
  2 cards side by side, each with teal left border:
  Mission: "To connect US companies with skilled IT
  professionals through fast, reliable, and transparent
  staffing."
  Vision: "To be the go-to IT staffing partner for US
  companies that need quality talent without enterprise
  agency overhead."

SECTION — WHAT WE DON'T DO (surface-card #f5f5f5):
  H2: "What We Don't Do"
  Body: "We believe in being direct about our scope."
  3 items with X icons (red):
  - We don't pad candidate lists with unqualified profiles
  - We don't work with clients outside the US market
  - We don't offer non-IT staffing or general consulting

CTA BAND then FOOTER.

═══════════════════════════════════════════════════════════
PHASE 5 — SERVICES PAGE
═══════════════════════════════════════════════════════════

File: src/app/(public)/services/page.tsx

HERO (dark navy #0f172a):
  H1: "IT Staffing Services"
  Body: "Contract, C2C, Contract-to-Hire, and Full-Time
  placement for US-based IT roles."

SECTION — STAFFING MODELS (white canvas, id="staffing"):
  H2: "Staffing Models"
  4 cards 2x2 grid (same design as homepage ServicesOverview)

SECTION — TECHNOLOGY DOMAINS (surface-card, id="domains"):
  H2: "Technology Domains"
  Same tag cloud as homepage TechDomains section.
  Plus a simple table:
  | Domain              | Typical Roles                        |
  | Software Dev        | Java Dev, .NET Dev, Full-Stack        |
  | Cloud/DevOps        | AWS Architect, DevOps Engineer        |
  | Data Science        | ML Engineer, Data Analyst             |
  | Cybersecurity       | Security Analyst, Pen Tester          |
  | QA                  | SDET, QA Automation Engineer          |
  | ERP                 | SAP Consultant, Workday Admin         |

SECTION — HOW WE WORK (white canvas, id="process"):
  Same 3-step process as homepage HowItWorks section.

CTA BAND then FOOTER.

═══════════════════════════════════════════════════════════
PHASE 6 — INDUSTRIES PAGE
═══════════════════════════════════════════════════════════

File: src/app/(public)/industries/page.tsx

HERO (dark navy #0f172a):
  H1: "Industries We Serve"
  Body: "We have active placements in these industries.
  We only list what we've earned."

SECTION — INDUSTRIES (white canvas):
  3 cards only (remove Manufacturing and Retail):
  1. Information Technology
  2. Healthcare (Health IT focus)
  3. Banking & Finance (Fintech, Risk, Compliance)
  Each card: surface-card bg, 12px radius, 32px padding
  Icon + title + description + key area tags

  Below the 3 cards, a full-width note card (teal left border):
  "We're actively expanding. If your industry isn't listed,
  contact us — we may still be able to help."
  CTA: "Contact Us" → /contact

CTA BAND then FOOTER.

═══════════════════════════════════════════════════════════
PHASE 7 — CONTACT PAGE
═══════════════════════════════════════════════════════════

File: src/app/(public)/contact/page.tsx

HERO (dark navy #0f172a):
  H1: "Submit a Staffing Requirement"
  Body: "Fill out the form below. We respond within
  24 hours with a tailored proposal."

SECTION — FORM + INFO (white canvas):
  5-column grid: 2 cols info left, 3 cols form right.
  Left: contact info (email, phone, address, hours)
  Right: InquiryForm.tsx (keep unchanged — it works)

  Below the form, "What Happens Next" 3-step mini-flow:
  Step 1: We review your requirement (same day)
  Step 2: We identify matched candidates (1-2 days)
  Step 3: We send you a shortlist
          (3-5 days contract, 7-10 days full-time)

FOOTER only (no CTA band on contact page).

═══════════════════════════════════════════════════════════
PHASE 8 — FOOTER (rebuild)
═══════════════════════════════════════════════════════════

File: src/components/layout/Footer.tsx

Background: #0f172a (dark navy — ONLY dark surface)
Text: #a1a1aa
Padding: 64px vertical

4-column layout:
Col 1 — Brand:
  Logo (white version)
  Tagline: "US-Based IT Staffing.
  Contract, C2C, Full-Time."
  LinkedIn icon link only (remove Twitter)
  Email icon link

Col 2 — Company:
  About · Services · Industries · Contact

Col 3 — Services:
  Contract Staffing · C2C Placements
  Contract-to-Hire · Full-Time Recruitment

Col 4 — Contact:
  hr@primetekglobalsolutions.com
  +1 (219) 345-6559
  Birmingham, AL 35205, USA

Bottom bar:
  © 2024 Primetek Global Solutions. All rights reserved.
  Privacy Policy → /privacy
  Terms of Service → /terms

═══════════════════════════════════════════════════════════
PHASE 9 — PRIVACY & TERMS PAGES (new)
═══════════════════════════════════════════════════════════

src/app/(public)/privacy/page.tsx
src/app/(public)/terms/page.tsx

Both pages: white canvas, max-w-3xl centered,
clean typography, no fancy design.

Privacy Policy must cover:
- Data collected: name, email, phone from contact form
- How used: to respond to inquiries only
- Not sold to third parties
- Contact: hr@primetekglobalsolutions.com
- Last updated: 2024

Terms of Service must cover:
- Use of website
- No warranties on information accuracy
- Limitation of liability
- Governing law: Alabama, USA
- Contact: hr@primetekglobalsolutions.com

═══════════════════════════════════════════════════════════
PHASE 10 — GLOBALS & TAILWIND CONFIG
═══════════════════════════════════════════════════════════

Update src/app/globals.css — add CSS custom properties:
  --color-primary: #0f766e
  --color-primary-active: #0d6460
  --color-canvas: #ffffff
  --color-surface-card: #f5f5f5
  --color-surface-dark: #0f172a
  --color-hairline: #e5e7eb
  --color-ink: #111111
  --color-body: #374151
  --color-muted: #6b7280
  --color-accent: #14b8a6

Update tailwind.config.ts — add custom color tokens:
  teal-primary: #0f766e
  teal-active: #0d6460
  teal-accent: #14b8a6
  surface-card: #f5f5f5
  surface-dark: #0f172a
  ink: #111111
  body-text: #374151
  muted: #6b7280
  hairline: #e5e7eb


═══════════════════════════════════════════════════════════
FAQ DATA (rewrite src/lib/faq-data.ts)
═══════════════════════════════════════════════════════════

Q1: What staffing models do you offer?
A: We offer Contract Staffing, C2C (Corp-to-Corp),
Contract-to-Hire, and Full-Time Recruitment. Each model
is designed for different hiring needs — from short-term
project work to permanent placements.

Q2: How quickly can you fill a position?
A: For contract and C2C roles, we typically present
shortlisted candidates within 3-5 business days.
For full-time placements, expect 7-10 business days.
Timelines depend on role complexity and availability.

Q3: What is C2C staffing?
A: C2C (Corp-to-Corp) is a model where an independent
contractor operates through their own business entity
and invoices the client company directly. It is commonly
used for specialized, project-based IT engagements in
the US market.

Q4: Which technology domains do you cover?
A: We place professionals in Software Development,
Data Science & AI/ML, Cloud & DevOps, Cybersecurity,
QA & Test Automation, ERP Technologies (SAP, Oracle,
Workday), and Business Analysis & Project Management.

Q5: Where are you located and which markets do you serve?
A: We are headquartered in Birmingham, Alabama, USA.
We serve US-based clients exclusively — Fortune 500
companies, mid-size enterprises, government agencies,
and startups across the United States.

Q6: How do I submit a staffing requirement?
A: Use the contact form on our Contact page, email us at
hr@primetekglobalsolutions.com, or call +1 (219) 345-6559.
We respond within 24 hours with a tailored proposal.

═══════════════════════════════════════════════════════════
BROKEN THINGS TO FIX
═══════════════════════════════════════════════════════════

1. Delete Stats.tsx — fake numbers, remove from homepage
2. Delete Testimonials.tsx — fake quotes, remove from homepage
3. Fix /services#consulting and /services#outsourcing
   broken anchors — remove those cards from ServicesOverview
4. Fix OG image in src/app/layout.tsx:
   Change static '/opengraph-image.png' to use the
   dynamic route generated by opengraph-image.tsx
5. Remove Twitter/X link from footer entirely
6. Create /privacy and /terms pages (Phase 9)
7. Remove GSAP from Hero.tsx — use framer-motion only

═══════════════════════════════════════════════════════════
PAGES & COMPONENTS SUMMARY
═══════════════════════════════════════════════════════════

Pages rebuilt (5):
  / (Home)
  /about
  /services
  /industries
  /contact

Pages created new (2):
  /privacy
  /terms

Components rebuilt:
  Navbar.tsx       → Radix UI mega menu
  Hero.tsx         → Remove GSAP, new layout
  ServicesOverview.tsx → Fix broken links, new design
  CTASection.tsx   → New copy and design
  Footer.tsx       → Remove Twitter, fix links

Components created new:
  HowItWorks.tsx   → 3-step process section
  TechDomains.tsx  → Tech domain tag cloud

Components deleted:
  Stats.tsx        → Fake numbers
  Testimonials.tsx → Fake quotes

═══════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════

1. Read all existing files listed at the top before
   writing a single line of new code.
2. Only new dependency allowed:
   @radix-ui/react-navigation-menu
3. Keep InquiryForm.tsx unchanged — it works correctly.
4. Keep all SEO metadata and JSON-LD schema markup.
5. Every internal link must point to a route that exists
   after this build. No placeholder href="#" links.
6. No fake data — no invented stats, no fake testimonials.
7. Every page must have a proper h1.
8. Section rhythm must alternate:
   white → surface-card → white → surface-card → dark footer
9. Mobile-first — every section works at 375px width.
10. Run npm run build after all changes to verify
    zero TypeScript and build errors.
11. The footer is the ONLY dark surface on every page.
    Do not add dark cards or dark sections anywhere else.
12. Primary CTA color is teal (#0f766e) everywhere.
    Never use black as a CTA color.
13. Display headings: Inter 600 with negative letter-spacing.
    Body: Inter 400 with zero letter-spacing.
    Never mix these roles.
14. Update page titles exactly as specified in the
    PAGE TITLES section at the top of this prompt.

