import {
  IconCalendar,
  IconUsers,
  IconGraduationCap,
  IconFileText,
  IconBriefcase,
  IconMessageSquare,
  IconHandshake,
  IconSunrise,
  IconTrending,
  IconFacebook,
  IconTwitter,
  IconLinkedin,
  IconYoutube,
  IconInstagram,
} from '../icons';

export const NAV = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/events', label: 'Events' },
  { to: '/members', label: 'Members' },
  { to: '/students', label: 'Students' },
  { to: '/resources', label: 'Resources' },
  { to: '/contact', label: 'Contact' },
];

// Official ICAI social media accounts (per Web-Media Policy 5r)
export const SOCIALS = [
  { Icon: IconFacebook,  label: 'Facebook',  href: 'https://www.facebook.com/theicai' },
  { Icon: IconTwitter,   label: 'Twitter',   href: 'https://twitter.com/theicai' },
  { Icon: IconLinkedin,  label: 'LinkedIn',  href: 'https://www.linkedin.com/edu/22460' },
  { Icon: IconYoutube,   label: 'YouTube',   href: 'https://www.youtube.com/icaiorgtube' },
  { Icon: IconInstagram, label: 'Instagram', href: 'https://www.instagram.com/icaiorg/' },
];

// Official ICAI portal links (per Web-Media Policy 5s)
export const ICAI_LINKS = [
  { label: 'Self Service Portal',  url: 'https://eservices.icai.org' },
  { label: 'Digital Learning Hub', url: 'https://learning.icai.org' },
  { label: 'CDS',                  url: 'https://cds.icai.org/cds/marketplace' },
  { label: 'ICAI Social Media',    url: 'https://www.icai.org/followus' },
  { label: 'ICAI Mobile App',      url: 'https://www.icai.org/mobile/' },
  { label: 'eSahaayataa',          url: 'https://www.icai.org/help/' },
  { label: 'ICAI TV',              url: 'http://icaitv.com/' },
];

// audience: 'Members' | 'Students' | 'All'
export const HOME_EVENTS = [
  // Direct Tax
  { title: 'Direct Tax Amendments — Practical Insights', committee: 'Direct Tax', audience: 'Members', date: '18 May 2026', time: '5:00 PM', venue: 'ICAI Bhawan, Nagpur', cpe: 3,
    speaker: 'CA Rahul Sharma',
    highlights: [
      'Key amendments from the latest Finance Act with worked examples',
      'Impact on individual and corporate assessees',
      'Compliance checklist for the upcoming assessment year',
    ] },
  { title: 'TDS Compliance & New Forms Walkthrough', committee: 'Direct Tax', audience: 'Members', date: '02 Jun 2026', time: '5:30 PM', venue: 'Online (Zoom)', cpe: 2,
    speaker: 'CA Priya Mehta',
    highlights: [
      'Section-wise TDS rate chart and recent changes',
      'Live walkthrough of revised return forms and corrections',
      'Common notices and how to respond effectively',
    ] },
  { title: 'Income Tax Assessment Procedures — Case Studies', committee: 'Direct Tax', audience: 'Members', date: '14 Jun 2026', time: '10:00 AM', venue: 'Hotel Centre Point', cpe: 4,
    speaker: 'CA Anjali Singh',
    highlights: [
      'Faceless assessment workflow explained end to end',
      'Real case studies on scrutiny and reassessment',
      'Drafting effective submissions and replies',
    ] },
  { title: 'Capital Gains Taxation — Recent Judicial Developments', committee: 'Direct Tax', audience: 'Members', date: '28 Jun 2026', time: '5:00 PM', venue: 'ICAI Bhawan, Nagpur', cpe: 3,
    speaker: 'CA Vikram Joshi',
    highlights: [
      'Recent ITAT and High Court rulings on capital gains',
      'Exemption planning under sections 54 and 54F',
      'Reporting capital gains in the revised ITR schema',
    ] },

  // GST
  { title: 'GST Annual Return & Audit Workshop', committee: 'GST', audience: 'Members', date: '22 May 2026', time: '10:00 AM', venue: 'Hotel Centre Point', cpe: 6,
    speaker: 'CA Suresh Patel',
    highlights: [
      'Step-by-step GSTR-9 and GSTR-9C preparation',
      'Reconciliation of books with returns filed',
      'Common errors that trigger departmental notices',
    ] },
  { title: 'GST Input Tax Credit — Practical Issues', committee: 'GST', audience: 'Members', date: '05 Jun 2026', time: '5:00 PM', venue: 'ICAI Bhawan, Nagpur', cpe: 3,
    speaker: 'CA Rahul Desai',
    highlights: [
      'ITC eligibility, blocked credits and reversal rules',
      'Matching ITC with GSTR-2B in practice',
      'Handling supplier defaults and mismatches',
    ] },
  { title: 'E-Invoicing & E-Way Bill — Compliance Update', committee: 'GST', audience: 'Members', date: '19 Jun 2026', time: '4:30 PM', venue: 'Online (Teams)', cpe: 2,
    speaker: 'CA Neha Gupta',
    highlights: [
      'Latest e-invoicing thresholds and exemptions',
      'Generating and amending e-way bills correctly',
      'Penalties and how to avoid common lapses',
    ] },
  { title: 'GST Litigation & Advance Ruling Insights', committee: 'GST', audience: 'Members', date: '03 Jul 2026', time: '10:00 AM', venue: 'Chitnavis Centre', cpe: 4,
    speaker: 'CA Suresh Patel',
    highlights: [
      'Structure of the GST appellate process',
      'Notable advance rulings and their practical impact',
      'Drafting replies to show-cause notices',
    ] },

  // WICASA
  { title: 'WICASA Mock Test Series — Foundation', committee: 'WICASA', audience: 'Students', date: '25 May 2026', time: '9:00 AM', venue: 'Branch Premises', cpe: 0,
    speaker: 'CA Deepika Rao',
    highlights: [
      'Full-syllabus mock papers under exam conditions',
      'Detailed answer-key discussion and evaluation',
      'Time-management and answer-presentation tips',
    ] },
  { title: 'Articleship Orientation & Industry Talk', committee: 'WICASA', audience: 'Students', date: '07 Jun 2026', time: '11:00 AM', venue: 'ICAI Bhawan, Nagpur', cpe: 0,
    speaker: 'CA Manoj Kulkarni',
    highlights: [
      'What to expect during your articleship journey',
      'Choosing the right firm and area of specialisation',
      'Industry leaders share career-building advice',
    ] },
  { title: 'CA Intermediate — Paper 6 Strategy Session', committee: 'WICASA', audience: 'Students', date: '21 Jun 2026', time: '10:00 AM', venue: 'Branch Premises', cpe: 0,
    speaker: 'CA Kavita Rao',
    highlights: [
      'Chapter-wise weightage and a preparation roadmap',
      'Solving practical problems efficiently',
      'Revision strategy for the final month',
    ] },
  { title: 'WICASA Annual Cultural & Sports Meet 2026', committee: 'WICASA', audience: 'All', date: '12 Jul 2026', time: '9:00 AM', venue: 'Sports Complex, Nagpur', cpe: 0,
    speaker: 'NICASA Committee',
    highlights: [
      'Inter-batch sports, cultural and talent competitions',
      'Networking with CA students from across the region',
      'Prize distribution and felicitation ceremony',
    ] },

  // Audit
  { title: 'Audit Quality & Documentation', committee: 'Audit', audience: 'Members', date: '01 Jun 2026', time: '5:30 PM', venue: 'Online (Zoom)', cpe: 2,
    speaker: 'CA Rekha Nair',
    highlights: [
      'Building an audit file that withstands review',
      'Documentation requirements under SQC 1',
      'Common quality-review observations to avoid',
    ] },
  { title: 'SA 315 — Risk Assessment in Practice', committee: 'Audit', audience: 'Members', date: '15 Jun 2026', time: '5:00 PM', venue: 'ICAI Bhawan, Nagpur', cpe: 3,
    speaker: 'CA Manoj Kulkarni',
    highlights: [
      'Understanding the entity and its environment',
      'Identifying and assessing risks of material misstatement',
      'Linking risk assessment to audit procedures',
    ] },
  { title: 'Bank Audit — Issues & Best Practices', committee: 'Audit', audience: 'Members', date: '29 Jun 2026', time: '10:00 AM', venue: 'Hotel Centre Point', cpe: 4,
    speaker: 'CA Vivek Joshi',
    highlights: [
      'LFAR, IRAC norms and provisioning essentials',
      'Verifying advances, NPAs and documentation',
      'Practical tips for timely completion',
    ] },
  { title: 'Peer Review Programme — Overview & FAQs', committee: 'Audit', audience: 'Members', date: '10 Jul 2026', time: '4:00 PM', venue: 'Online (Zoom)', cpe: 2,
    speaker: 'CA Rekha Nair',
    highlights: [
      'Who needs peer review and when',
      'Preparing your practice unit for review',
      'Frequently asked questions answered',
    ] },

  // IT
  { title: 'AI Tools for Chartered Accountants', committee: 'IT', audience: 'Members', date: '08 Jun 2026', time: '4:00 PM', venue: 'ICAI Bhawan', cpe: 3,
    speaker: 'CA Neha Gupta',
    highlights: [
      'Practical AI tools for audit, tax and advisory work',
      'Automating routine documentation and research',
      'Data privacy and professional caution',
    ] },
  { title: 'Excel Automation & Power Query for CAs', committee: 'IT', audience: 'Members', date: '22 Jun 2026', time: '10:00 AM', venue: 'Branch Premises', cpe: 3,
    speaker: 'CA Sunita Bhatt',
    highlights: [
      'Power Query for cleaning and merging data',
      'Building reusable, automated working papers',
      'Time-saving formulas and shortcuts',
    ] },
  { title: 'Cybersecurity Essentials for CA Firms', committee: 'IT', audience: 'Members', date: '06 Jul 2026', time: '5:00 PM', venue: 'Online (Zoom)', cpe: 2,
    speaker: 'CA Dinesh Thakre',
    highlights: [
      'Common threats facing accounting practices',
      'Securing client data and email communication',
      'Building a simple incident-response plan',
    ] },
  { title: 'Data Analytics in Audit & Assurance', committee: 'IT', audience: 'Members', date: '20 Jul 2026', time: '10:00 AM', venue: 'Hotel Centre Point', cpe: 4,
    speaker: 'CA Arjun Mehta',
    highlights: [
      'Using analytics for sampling and anomaly detection',
      'Visualising audit evidence effectively',
      'Tools and techniques you can apply immediately',
    ] },

  // CPE
  { title: 'Annual Regional Conference 2026', committee: 'CPE', audience: 'All', date: '20 Jun 2026', time: '9:00 AM', venue: 'Chitnavis Centre', cpe: 12,
    speaker: 'Multiple National Speakers',
    highlights: [
      'Two days of technical sessions across domains',
      'National-level faculty and panel discussions',
      'Networking with peers from across the region',
    ] },
  { title: 'Full-Day CPE Seminar — Finance & Economy', committee: 'CPE', audience: 'Members', date: '04 Jul 2026', time: '9:30 AM', venue: 'Hotel Centre Point', cpe: 6,
    speaker: 'CA Arjun Mehta',
    highlights: [
      'Macro-economic outlook and its impact on practice',
      'Sessions on corporate finance and valuation',
      'Interactive Q&A with subject experts',
    ] },
  { title: 'CPE Study Circle — Monthly Meeting', committee: 'CPE', audience: 'Members', date: '18 Jul 2026', time: '5:30 PM', venue: 'ICAI Bhawan, Nagpur', cpe: 2,
    speaker: 'CA Kavita Rao',
    highlights: [
      'Peer-led discussion on a current professional topic',
      'Sharing of practical experiences and queries',
      'Structured CPE credit in a collegial setting',
    ] },
  { title: 'National CPE Webinar — FEMA Updates 2026', committee: 'CPE', audience: 'Members', date: '01 Aug 2026', time: '3:00 PM', venue: 'Online (Zoom)', cpe: 3,
    speaker: 'CA Anjali Singh',
    highlights: [
      'Recent FEMA notifications and circulars',
      'Practical issues in foreign remittances and investment',
      'Compliance and reporting requirements',
    ] },
];

export const SERVICES = [
  { Icon: IconCalendar, title: 'Events & CPE', desc: 'Browse upcoming seminars, workshops and conferences across committees.', to: '/events' },
  { Icon: IconUsers, title: 'For Members', desc: 'Member services, COP, UDIN, firm directory, networking and more.', to: '/members' },
  { Icon: IconGraduationCap, title: 'For Students', desc: 'WICASA events, mock tests, articleship vacancies and career guidance.', to: '/students' },
  { Icon: IconFileText, title: 'Resources', desc: 'Standards, circulars, e-journal archive and downloadable newsletters.', to: '/resources' },
  { Icon: IconBriefcase, title: 'Career Counselling', desc: 'Book one-to-one sessions with volunteers and alma mater mentors.', to: '/career-counselling' },
  { Icon: IconMessageSquare, title: 'Grievance & Help', desc: 'Raise grievances or reach the branch through eSahaayataa.', to: '/contact' },
  { Icon: IconHandshake, title: 'CA Benevolent Fund', desc: 'Contribute to CABF — financial relief for members & families in distress.', to: '/benevolent-fund' },
  { Icon: IconSunrise, title: 'CA 2.0 — Life After Office', desc: 'A meaningful second innings for senior CAs — wellness, mentorship & hobby circles.', to: '/ca2-vision' },
];

export const INITIATIVES = [
  { Icon: IconHandshake, title: 'CA Benevolent Fund', desc: 'Contribute to CABF — financial relief for members & families in distress.', to: '/benevolent-fund', cta: 'Contribute' },
  { Icon: IconSunrise, title: 'CA 2.0 — Life After Office', desc: 'A meaningful second innings for senior CAs — wellness, mentorship & hobby circles.', to: '/ca2-vision', cta: 'Explore' },
  { Icon: IconTrending, title: 'Investor Awareness', desc: 'Free programmes promoting financial literacy and safe investing for the public.', to: '/investor-awareness', cta: 'Learn more' },
  { Icon: IconBriefcase, title: 'Career Counselling', desc: 'Book one-to-one sessions with volunteer CAs and alma-mater mentors.', to: '/career-counselling', cta: 'Book a session' },
];

// Job vacancies
export const ARTICLE_VACANCIES = [
  { firm: 'M/s Joshi & Associates', location: 'Nagpur', seats: 2, contact: 'joshi.ca@example.com', posted: '05 May 2026' },
  { firm: 'M/s Patel & Co.', location: 'Nagpur', seats: 1, contact: 'patelandco@example.com', posted: '03 May 2026' },
  { firm: 'M/s Gupta Mehta & Partners', location: 'Nagpur', seats: 3, contact: 'gmp.nagpur@example.com', posted: '01 May 2026' },
  { firm: 'M/s Sharma & Verma LLP', location: 'Nagpur', seats: 1, contact: 'sharmaverma@example.com', posted: '28 Apr 2026' },
  { firm: 'M/s Desai Tax Consultants', location: 'Nagpur', seats: 2, contact: 'desaitax@example.com', posted: '25 Apr 2026' },
  { firm: 'M/s Rao & Krishnan LLP', location: 'Nagpur', seats: 2, contact: 'raokrishnan@example.com', posted: '22 Apr 2026' },
];

export const MEMBER_VACANCIES = [
  { role: 'Senior Auditor', firm: 'M/s Krishnamurthy & Co.', exp: '3–5 years', location: 'Nagpur', posted: '06 May 2026' },
  { role: 'GST Consultant', firm: 'ABC Industries Ltd.', exp: '2+ years', location: 'Nagpur / Remote', posted: '04 May 2026' },
  { role: 'Chief Financial Officer', firm: 'XYZ Agro Pvt. Ltd.', exp: '10+ years', location: 'Nagpur', posted: '02 May 2026' },
  { role: 'Audit Manager', firm: 'M/s Rao & Partners', exp: '5–7 years', location: 'Nagpur', posted: '30 Apr 2026' },
  { role: 'Internal Auditor', firm: 'Central Coalfields Ltd.', exp: '4+ years', location: 'Nagpur', posted: '27 Apr 2026' },
];

// Paper Presentations (per Web-Media Policy 5p — must carry ICAI disclaimer)
export const PAPER_PRESENTATIONS = [
  { title: 'Impact of GST on MSME Sector — Challenges & Opportunities', speaker: 'CA Rahul Sharma', event: 'GST Annual Workshop 2025', date: '15 Nov 2025', committee: 'GST' },
  { title: 'Direct Tax Amendments — Finance Act 2025 Analysis', speaker: 'CA Priya Mehta', event: 'Direct Tax Seminar 2025', date: '18 Oct 2025', committee: 'Direct Tax' },
  { title: 'AI and Machine Learning in Audit Practices', speaker: 'CA Suresh Patel', event: 'IT Committee Seminar 2025', date: '08 Sep 2025', committee: 'IT' },
  { title: 'Audit Quality Benchmarks — A Practical Approach', speaker: 'CA Anjali Singh', event: 'Audit Quality Workshop 2025', date: '22 Aug 2025', committee: 'Audit' },
  { title: 'CPE Framework — New ICAI Guidelines Overview', speaker: 'CA Vikram Joshi', event: 'Annual CPE Conference 2025', date: '10 Jul 2025', committee: 'CPE' },
  { title: 'Articleship — Building a Strong Foundation for Your Career', speaker: 'CA Deepika Rao', event: 'WICASA Student Convention 2025', date: '05 Jun 2025', committee: 'WICASA' },
];

// Gallery event albums
export const GALLERY_EVENTS = [
  { title: 'Annual Regional Conference 2025', date: 'Jun 2025', committee: 'CPE', photos: 48, color: '#2563eb', bg: '#eff6ff' },
  { title: 'GST Annual Workshop 2025', date: 'Nov 2025', committee: 'GST', photos: 24, color: '#16a34a', bg: '#f0fdf4' },
  { title: 'WICASA Student Convention 2025', date: 'Jun 2025', committee: 'WICASA', photos: 36, color: '#7c3aed', bg: '#f5f3ff' },
  { title: 'Direct Tax Seminar 2025', date: 'Oct 2025', committee: 'Direct Tax', photos: 18, color: '#ea580c', bg: '#fff7ed' },
  { title: 'IT Tools Workshop 2025', date: 'Sep 2025', committee: 'IT', photos: 21, color: '#4f46e5', bg: '#eef2ff' },
  { title: 'Audit Quality Workshop 2025', date: 'Aug 2025', committee: 'Audit', photos: 15, color: '#0891b2', bg: '#ecfeff' },
  { title: 'Branch Anniversary Celebrations 2025', date: 'Dec 2025', committee: 'Branch', photos: 56, color: '#be185d', bg: '#fdf2f8' },
  { title: 'Investor Awareness Programme 2025', date: 'Mar 2025', committee: 'Branch', photos: 30, color: '#d97706', bg: '#fffbeb' },
  { title: 'WICASA Mock Test Series 2025', date: 'May 2025', committee: 'WICASA', photos: 12, color: '#7c3aed', bg: '#f5f3ff' },
  { title: 'CA 2.0 Wellness & Mentorship Day', date: 'Feb 2025', committee: 'Branch', photos: 20, color: '#0f766e', bg: '#f0fdfa' },
  { title: 'CPE Study Circle Monthly Meets', date: 'Ongoing', committee: 'CPE', photos: 42, color: '#2563eb', bg: '#eff6ff' },
  { title: 'Career Counselling Sessions 2025', date: 'Quarterly', committee: 'Branch', photos: 9, color: '#6b7280', bg: '#f9fafb' },
];

// Members' Directory (accessible to logged-in members only — per Web-Media Policy 5n)
export const MEMBERS_DIRECTORY = [
  { name: 'CA Arjun Mehta', memNo: 'NAG-012345', status: 'FCA', area: 'Direct Tax & Corporate Law', city: 'Nagpur' },
  { name: 'CA Priya Sharma', memNo: 'NAG-023456', status: 'ACA', area: 'Audit & Assurance', city: 'Nagpur' },
  { name: 'CA Suresh Patel', memNo: 'NAG-034567', status: 'FCA', area: 'GST & Indirect Tax', city: 'Nagpur' },
  { name: 'CA Neha Gupta', memNo: 'NAG-045678', status: 'ACA', area: 'IT Audit & Systems', city: 'Nagpur' },
  { name: 'CA Vivek Joshi', memNo: 'NAG-056789', status: 'FCA', area: 'Bank Audit & Finance', city: 'Nagpur' },
  { name: 'CA Anjali Singh', memNo: 'NAG-067890', status: 'FCA', area: 'Direct Tax & FEMA', city: 'Nagpur' },
  { name: 'CA Rahul Desai', memNo: 'NAG-078901', status: 'ACA', area: 'GST & VAT', city: 'Nagpur' },
  { name: 'CA Kavita Rao', memNo: 'NAG-089012', status: 'FCA', area: 'CPE & Training', city: 'Nagpur' },
  { name: 'CA Manoj Kulkarni', memNo: 'NAG-090123', status: 'FCA', area: 'Statutory Audit', city: 'Nagpur' },
  { name: 'CA Sunita Bhatt', memNo: 'NAG-101234', status: 'ACA', area: 'Income Tax Returns', city: 'Nagpur' },
  { name: 'CA Dinesh Thakre', memNo: 'NAG-112345', status: 'FCA', area: 'Corporate & NCLT', city: 'Nagpur' },
  { name: 'CA Rekha Nair', memNo: 'NAG-123456', status: 'FCA', area: 'Audit & Risk Advisory', city: 'Nagpur' },
];
