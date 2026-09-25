/*
  PowerChapter prototype — chapter, benefit and sample content configuration.

  EVERYTHING IN THIS FILE IS SAMPLE CONTENT except:
    - county FIPS codes (real), used to pull real business counts from territory-data.js
    - the two provider names and listed values in BENEFITS, as published on powerchapter.com

  To add a real chamber: copy one CHAPTERS entry, give it a unique id, set the
  chamber's name, city, state, lat/lng (city center is fine), the FIPS codes of
  the counties it serves, and status "live" or "onboarding". Profile values
  (founded, members, acknowledgedYear) come from the chamber.
*/
window.PC_CONFIG = {
  // Miles. If the nearest chapter is farther than this, the site says there is
  // no chapter near the visitor instead of assigning a distant one.
  nearRadiusMiles: 150,

  // Sum of the listed values above, shown on the chambers page. Update it when a listed value changes.
  bookValueTotal: "$3,696.88",

  CHAPTERS: [
    { id:"tampa-bay", name:"Sample Chapter — Tampa Bay", city:"Tampa", st:"FL", lat:27.9506, lng:-82.4572,
      status:"live", counties:["12057","12103","12101"], inviteCode:"TPA-DEMO",
      profile:{ founded:1885, members:1240, acknowledgedYear:2025 } },
    { id:"charlotte", name:"Sample Chapter — Charlotte Region", city:"Charlotte", st:"NC", lat:35.2271, lng:-80.8431,
      status:"live", counties:["37119","37179","37025","37071"], inviteCode:"CLT-DEMO",
      profile:{ founded:1877, members:1810, acknowledgedYear:2025 } },
    { id:"columbus", name:"Sample Chapter — Central Ohio", city:"Columbus", st:"OH", lat:39.9612, lng:-82.9988,
      status:"live", counties:["39049","39041","39089"], inviteCode:"CMH-DEMO",
      profile:{ founded:1884, members:960, acknowledgedYear:2025 } },
    { id:"dallas", name:"Sample Chapter — North Texas", city:"Dallas", st:"TX", lat:32.7767, lng:-96.797,
      status:"live", counties:["48113","48085","48121"], inviteCode:"DFW-DEMO",
      profile:{ founded:1909, members:2150, acknowledgedYear:2026 } },
    { id:"phoenix", name:"Sample Chapter — Greater Phoenix", city:"Phoenix", st:"AZ", lat:33.4484, lng:-112.074,
      status:"live", counties:["04013"], inviteCode:"PHX-DEMO",
      profile:{ founded:1888, members:1420, acknowledgedYear:2026 } },
    { id:"denver", name:"Sample Chapter — Denver Metro", city:"Denver", st:"CO", lat:39.7392, lng:-104.9903,
      status:"live", counties:["08031","08005","08059","08001"], inviteCode:"DEN-DEMO",
      profile:{ founded:1867, members:1330, acknowledgedYear:2026 } },
    { id:"atlanta", name:"Sample Chapter — Metro Atlanta", city:"Atlanta", st:"GA", lat:33.749, lng:-84.388,
      status:"onboarding", counties:["13121","13089","13067"], inviteCode:"ATL-DEMO",
      profile:{ founded:1860, members:2480, acknowledgedYear:2026 } },
    { id:"nashville", name:"Sample Chapter — Middle Tennessee", city:"Nashville", st:"TN", lat:36.1627, lng:-86.7816,
      status:"onboarding", counties:["47037","47187"], inviteCode:"BNA-DEMO",
      profile:{ founded:1847, members:1090, acknowledgedYear:2026 } }
  ],

  BENEFITS: [
    { id:"zenhur", provider:"Zenhur", title:"All Capital Access Dashboard", short:"All Capital Access Dashboard",
      cat:"Capital access", listedValue:"$2,497 per year per user", live:true, detail:true,
      intakeUrl:"https://admin.zenhur.com", logo:"assets/photos/zenhur-logo.png",
      blurb:"A capital access platform that gives businesses visibility into funding sources, capital options, and financial access tools.",
      whatItIs:"Zenhur's All Capital Access Dashboard is a capital access platform that provides businesses with visibility into funding sources, capital options, and financial access tools. The dashboard helps you identify, evaluate, and pursue funding sources that may be relevant to your business.",
      whatToKnow:[
        "You sign in to Zenhur directly at admin.zenhur.com. Your chamber gives you the access details.",
        "Your relationship with Zenhur is between you and Zenhur. Your chamber and PowerChapter do not receive the information you enter there.",
        "For technical issues with the dashboard, contact Zenhur support.",
        "For questions about whether this benefit is part of your membership, contact your chamber."
      ] },
    { id:"jacht", provider:"Jacht", title:"Jacht App", short:"Jacht App", cat:"Business tools",
      listedValue:"$99.99 per user per month ($1,199.88 per year)", live:true, detail:true, descriptionPending:true, logo:null,
      intakeUrl:null,
      blurb:"A business service application listed in The Book. The provider's description will appear here once Jacht supplies it.",
      whatItIs:"",
      whatToKnow:[
        "You access Jacht directly through the link your chamber provides.",
        "Your relationship with Jacht is between you and Jacht. Your chamber and PowerChapter do not receive the information you enter there.",
        "For technical issues with the app, contact Jacht support.",
        "For questions about whether this benefit is part of your membership, contact your chamber."
      ] },
    { id:"slot-1", slot:true, cat:"Operations", title:"Reserved for a vetted provider", blurb:"Every benefit meets a Gold Standard of longevity and reliability before it is listed." },
    { id:"slot-2", slot:true, cat:"People & payroll", title:"Reserved for a vetted provider", blurb:"Chambers see new benefits in their admin view before members do." },
    { id:"slot-3", slot:true, cat:"Marketing", title:"Reserved for a vetted provider", blurb:"Provider slots open as PowerChapter completes its review." }
  ],

  // Member questions, from the chamber member benefits document.
  BENEFIT_FAQ: [
    { q:"What does this cost me?",
      a:"Nothing through your chamber. PowerChapter charges nothing to chambers or members, and the providers in The Book have agreed to make their services available to members of acknowledged chambers at no charge. Each provider sets its own terms, and your chamber will tell you if any of them change." },
    { q:"Do I have to buy anything?",
      a:"No. Using a benefit does not commit you to buying anything from the provider or from your chamber." },
    { q:"Who holds my information?",
      a:"PowerChapter holds only your name, email, business name, chapter, and consent record. Everything you enter with a provider stays with that provider under its own terms. Your chamber holds its own membership records, as it always has." },
    { q:"Is my data sold or shared?",
      a:"No. PowerChapter does not sell member data and does not receive what you submit to a provider. Your chamber does not share its membership records with PowerChapter." },
    { q:"What happens if I leave the chamber?",
      a:"Access to these benefits follows your chamber membership. If your membership ends, your access through PowerChapter ends. You are free to continue directly with any provider at its standard rates." },
    { q:"What if I have trouble getting in?",
      a:"Check the access details your chamber sent first. For a technical problem with the service itself, contact that provider's support. For anything about your membership, contact your chamber." },
    { q:"Can my employees use the benefits too?",
      a:"That depends on each provider's terms — some are per business, some per individual user. Your chamber will confirm which applies before you sign up." },
    { q:"Will more benefits be added?",
      a:"Yes. PowerChapter continues to review providers for The Book. When a benefit is added, your chamber decides when to introduce it, and you get access at no additional cost." },
    { q:"Who is PowerChapter?",
      a:"An independent nonprofit that grants Acknowledgement to Chambers of Commerce based on demonstrated standing in their communities, and maintains The Book of Business Building Benefits. It generates no revenue and its operators receive no income from it." },
    { q:"Why is this available at no cost?",
      a:"The providers have chosen the chamber channel for distribution. They see acknowledged chambers as trusted institutions, and they would rather reach members through that trust than through paid acquisition. Your chamber's reputation is the reason this is possible." }
  ],

  // Questions chambers ask, adapted from the outreach objection handling.
  CHAMBER_FAQ: [
    { q:"What is the catch?",
      a:"There isn't one, and it is the right question to ask. PowerChapter is a nonprofit that generates no revenue and whose operators take no income from it. The providers have agreed to make their services available through acknowledged chambers at no charge because they would rather reach business owners through a trusted institution than through paid advertising. Your chamber pays nothing and your members pay nothing." },
    { q:"How does PowerChapter make money?",
      a:"It does not. There is no revenue share, no placement fee, no subscription, and no paid tier. Operating costs are covered by the providers under their agreements. The structure is deliberately clean so the credential is never in question." },
    { q:"Are you collecting data on our members?",
      a:"No. Your membership list stays with your chamber — PowerChapter never receives it. When a member activates, PowerChapter holds that member's name, email, business name, chapter, and consent record, and nothing else. What a member does inside a provider's platform stays with that provider." },
    { q:"Does our chamber get renamed or rebranded?",
      a:"No. Your chamber keeps its name, brand and identity. Members experience the benefits as your chamber's member benefit program. PowerChapter appears only where Acknowledgement itself is being described." },
    { q:"We are a small chamber. Does size count against us?",
      a:"Not at all. Size is explicitly excluded from the standard. A 150-member chamber with 30 years of standing is exactly the kind of institution this exists to acknowledge — and it will be acknowledged ahead of a 3,000-member chamber that formed two years ago." },
    { q:"What if a provider starts charging our members later?",
      a:"Tell PowerChapter. A provider that charges members, collects data without consent, or restricts access is removed from The Book, and every acknowledged chamber is notified." },
    { q:"How much work is this for our staff?",
      a:"Very little. You share an invite code or a roster, decide when to mention the benefits in the channels you already use, and answer the occasional membership question. There are no fees to collect, no reporting requirements, and no systems for your staff to learn." },
    { q:"What does it cost to leave?",
      a:"Nothing. There is no contract, no exclusivity, and no term. A chamber that wants out tells PowerChapter, and is removed from the directory." }
  ],

  // Sample chapter content (events, announcements, leadership) — replaced by each chamber.
  SAMPLE_EVENTS: [
    { m:"OCT", d:"08", t:"Member breakfast: local lending outlook", w:"Chamber boardroom · 7:30 AM" },
    { m:"OCT", d:"21", t:"Small business open house", w:"Downtown office · 4:00 PM" },
    { m:"NOV", d:"05", t:"New member orientation", w:"Online · 12:00 PM" }
  ],
  SAMPLE_ANNOUNCEMENTS: [
    { t:"The Book now lists the Capital Access Dashboard", when:"This week" },
    { t:"Board nominations open for the 2027 term", when:"2 weeks ago" }
  ],
  SAMPLE_LEADERS: [
    { r:"President & CEO" }, { r:"Board Chair" }, { r:"Membership Director" }
  ],

  // Demo-only visitor locations used by "Prototype controls" to simulate IP detection.
  DEMO_VISITORS: [
    { label:"Visitor from Tampa, FL", lat:28.0763, lng:-82.4852, city:"Tampa, FL" },
    { label:"Visitor from Plano, TX", lat:33.0198, lng:-96.6989, city:"Plano, TX" },
    { label:"Visitor from Lakewood, CO", lat:39.7047, lng:-105.0814, city:"Lakewood, CO" },
    { label:"Visitor from Boise, ID (no chapter nearby)", lat:43.615, lng:-116.2023, city:"Boise, ID" }
  ]
};
