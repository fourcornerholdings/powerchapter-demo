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
    { id:"zenhur", provider:"Zenhur", title:"Capital Access Dashboard + Business Credit & Funding Readiness Assessment",
      short:"Capital Access Dashboard", cat:"Capital readiness", listedValue:"$2,000 annual value per member",
      blurb:"See how your business looks to the people who review credit and funding applications, what is missing, and what to prepare. Includes a free Business Credit & Funding Readiness Assessment.",
      live:true, detail:true },
    { id:"jacht", provider:"Jacht App", title:"Jacht App", short:"Jacht App", cat:"Business tools",
      listedValue:"$99.99/month per user", blurb:"Listed in The Book. The provider's description will appear here once PowerChapter supplies it.",
      live:true, detail:false },
    { id:"slot-1", slot:true, cat:"Operations", title:"Reserved for a vetted provider", blurb:"Every benefit meets the Gold Standard of longevity and reliability before it is listed." },
    { id:"slot-2", slot:true, cat:"People & payroll", title:"Reserved for a vetted provider", blurb:"Chambers see new benefits in their admin view before members do." },
    { id:"slot-3", slot:true, cat:"Marketing", title:"Reserved for a vetted provider", blurb:"Provider slots open as PowerChapter completes its review." }
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
