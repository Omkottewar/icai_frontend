import { useEffect, useMemo, useState } from 'react';
import { cachedGet, subscribe } from '../lib/apiCache';

// Bake the existing hardcoded copy into the defaults map so a fresh install
// (no site_content rows in the DB) still renders the same page. Once admin
// seeds a slot through /admin/site-content, the DB row wins.
//
// When you add a new slot to src/lib/siteContentSlots.ts, add its default
// here too — otherwise the page renders an empty card on first load.
export const SITE_CONTENT_DEFAULTS = {
  chairman_message: {
    photo_url: 'https://ohpjavugvpqjbloxzluf.supabase.co/storage/v1/object/public/public-content/site/c4c18c20-7ee6-40a9-b6b3-83bb8a217261.webp',
    quote: 'Our branch remains committed to fostering a culture of integrity, lifelong learning and service — for our members, our students and the public we serve.',
    name: 'CA. Swaroopa Wazalwar',
    role_line: 'Chairperson, Nagpur Branch · 2026-27',
  },
  home_hero: {
    tagline: 'Serving Chartered Accountants and CA students of Nagpur — through Continuing Professional Education, networking, knowledge, and member services.',
  },
  home_hero_stats: {
    stats: [
      { k: '5,000+', v: 'Members' },
      { k: '8,500+', v: 'Students' },
      { k: '150+',   v: 'Events / yr' },
      { k: '1978',   v: 'Established' },
    ],
  },
  home_leadership_banner: {
    eyebrow: 'ESTABLISHED UNDER THE CHARTERED ACCOUNTANTS ACT, 1949',
    headline: 'Nurturing excellence in professional services for Nagpur.',
    body: 'The official portal of the Nagpur Branch of WIRC of ICAI — supporting over 4,000 members and 8,500+ students through education, regulation, workshops, industrial visits, sports festivals and continuous professional development.',
  },
  home_branch_premises: {
    image_url: 'https://ohpjavugvpqjbloxzluf.supabase.co/storage/v1/object/public/public-content/site/739ee5a8-8831-4843-aa8d-6dae1fa00ba9.webp',
    body: 'A purpose-built two-storey facility housing the Branch office, a 100-seat seminar hall, a digital library, reading room, itt lab, conferance hall and a dedicated student wing.',
    stats: [
      {
        k: '40 seats',
        v: 'READING ROOM',
      },
      {
        k: '100+',
        v: 'ITT LAB',
      },
    ],
  },
  // ── Defaults for the new section slots ──────────────────────────────
  // Each mirrors the current hardcoded copy so behaviour is identical
  // until an admin overrides a field.
  home_hero_text: {
    bg_image_url: null,
    watermark_url: null,
    badge: 'Branch of WIRC of ICAI',
    title_prefix: 'ICAI NAGPUR BRANCH ',
    title_highlight: '(WIRC)',
    title_suffix: 'Nagpur Branch (WIRC)',
    cta_events_label: 'Upcoming Events',
    cta_ai_label: 'Ask PrayGyaan AI',
    cta_signup_label: 'Create account',
  },
  home_leadership_extras: {
    cta_book_label:     'Book CPE Event',
    cta_download_label: 'Download Circulars',
    since_label:        'SINCE',
    since_year:         '1978',
  },
  home_leadership_carousel: {
    slide_1_url: 'https://ohpjavugvpqjbloxzluf.supabase.co/storage/v1/object/public/public-content/site/a8ee4858-1d29-44a1-a56a-9705eb691c20.webp',
    slide_1_caption: '',
    slide_1_alt: '',
    slide_2_url: 'https://ohpjavugvpqjbloxzluf.supabase.co/storage/v1/object/public/public-content/site/ba347927-78c2-4320-94e0-c7f664b9fcda.webp',
    slide_2_caption: '',
    slide_2_alt: '',
    slide_3_url: 'https://ohpjavugvpqjbloxzluf.supabase.co/storage/v1/object/public/public-content/site/084764d7-90a5-4f3e-a9bd-a80d475dd7bc.webp',
    slide_3_caption: '',
    slide_3_alt: '',
    slide_4_url: 'https://ohpjavugvpqjbloxzluf.supabase.co/storage/v1/object/public/public-content/site/3e015f3a-c34c-4dad-8c90-61189394b22c.webp',
    slide_4_caption: '',
    slide_4_alt: '',
  },
  home_services_section: {
    eyebrow: 'SERVICES',
    title:   'Explore the Branch',
    body:    'Everything the Nagpur Branch offers — from CPE programmes and student mentorship to career counselling and member welfare initiatives.',
  },
  home_events_section: {
    events_eyebrow:        'EVENTS',
    events_title:          'Upcoming programmes and Events',
    events_view_all_label: 'View full calendar →',
    upcoming_eyebrow:      'UPCOMING EVENTS',
    committees_eyebrow:    'BROWSE BY COMMITTEE',
    committees_title:      'Committee categories',
  },
  home_premises_section: {
    outer_eyebrow:      'OUR HOME',
    outer_title:        'Branch premises & student wing',
    inner_eyebrow:      'BRANCH PREMISES',
    inner_title:        'ICAI Bhawan, Dhantoli',
    reading_room_label: 'Book the Reading Room',
  },
  reading_room_page: {
    title:    'Reading Room — monthly pass',
    subtitle: '40-seat study hall at ICAI Bhawan, Dhantoli. Open Mon–Sat, 8 AM – 10 PM.',
    location_hint: 'ICAI Bhawan, Dhantoli · Mon–Sat, 8am–10pm',
    deposit_heading: 'Enrol with a one-time refundable deposit',
    deposit_body:    'Pay ₹500 once. It’s fully refundable when you exit — think of it as a security deposit for the seat card. Once verified, you can book any upcoming month.',
    non_student_msg: 'The reading room is dedicated to CA students of the branch. If you’re a student, sign in with your student account to enrol.',
    house_rules:
`• Bookings open on the 25th of every month for the next month.
• Seat is on a monthly basis — no daily slots. Show your student card at the desk on the 1st.
• Silence inside the hall. Discussions in the atrium.
• No food; sealed water bottles allowed. Lockers on request at the desk.
• Deposit is refunded on request when you stop using the facility (allow 7 working days).`,
  },
  home_knowledge_section: {
    eyebrow:        'KNOWLEDGE HUB',
    title:          'Circulars, standards & e-Journal',
    view_all_label: 'All resources →',
  },
  home_best_paper: {
    eyebrow:   'AWARD SPOTLIGHT',
    title:     'Best Paper Presentation',
    intro:     'Recognising outstanding student research at the Nagpur Branch.',
    cta_label: 'Read the winning paper →',
  },
  home_wicasa_card: {
    eyebrow:             'STUDENT WING',
    title:               'WICASA — Nagpur Branch',
    body:                "The Nagpur Branch CA Students' Association supports articleship trainees through orientation courses, mock tests, soft-skills training and the annual festival.",
    updates_heading:     'New updates',
    // Each non-empty line shows as one update pill in the card.
    updates: [
      'Mock Test Series for the May 2026 attempt — registration now open',
      'New ITT & Orientation batch begins 2 June at ICAI Bhawan',
      'Industrial visit to MIDC Butibori — sign up by 28 May',
    ].join('\n'),
    suggestions_heading: 'Student suggestions',
    signin_hint:         'Sign in to upvote',
    resources_label:     'STUDENT RESOURCES',
  },
  about_page_header: {
    title:    'About the Branch',
    subtitle: 'Established 1978 · Branch of WIRC of ICAI',
  },
  about_section_headings: {
    vision_card_title:        'A model branch of ICAI',
    mission_card_title:       'Service to the profession',
    history_card_title:       'Six decades of service',
    committee_heading:        'Managing Committee',
    committee_empty_msg:      'The roster will appear here once committee members are assigned.',
    past_chairmen_heading:    'Past Chairmen',
    past_chairmen_subtitle:   'Members who have led the Nagpur Branch over the decades.',
    annual_reports_heading:   'Annual Reports',
    annual_reports_subtitle:  'Year-on-year reports of branch activities, finances and member services.',
  },
  about_vision: {
    body: 'To be a leading branch dedicated to the holistic development of members and students through quality education, networking, and innovative initiatives.',
  },
  about_mission: {
    body: "Deliver world-class CPE programmes, advocate for members' interests, mentor students, and contribute to financial literacy in the wider community.",
  },
  about_history: {
    body: 'The Nagpur Branch was established in 1978 and has grown into one of the most active branches of WIRC, serving over 4,000 members and 8,500+ students.',
  },
  // ── Students page defaults ──────────────────────────────────────────
  students_page_header: {
    title:    'For Students',
    subtitle: 'Everything CA students of Nagpur need — in one place.',
  },
  students_icai_banner: {
    body:         'Registration, exam forms, results and study material are on the **official ICAI portal**.',
    button_label: 'Visit ICAI Students Portal',
    button_url:   'https://www.icai.org/students',
  },
  students_quick_access: {
    mock_tests_label:  'Mock tests',
    articleship_label: 'Articleship Vacancies',
    events_label:      'Student Events',
  },
  students_services: {
    card_1_title: 'WICASA Events & Mock Tests',
    card_1_desc:  'Foundation, Inter and Final mock tests, GMCS, ITT, orientation programmes.',
    card_2_title: 'Articleship Vacancies',
    card_2_desc:  'Browse openings posted by member firms across Nagpur and Vidarbha.',
    card_3_title: 'Career Counselling',
    card_3_desc:  'sessions with practising CAs and alma mater mentors.',
    card_4_title: 'Study Material & Resources',
    card_4_desc:  'Past papers, RTPs, MTPs and curated study notes.',
    card_5_title: 'Scholarships & Awards',
    card_5_desc:  'Information on merit-cum-need scholarships from CABF and the branch.',
    card_6_title: 'Mock-Test Discussions',
    card_6_desc:  'Discuss questions, solutions and strategies with other students for every Foundation / Inter / Final mock test.',
  },
  // ── Members page defaults ───────────────────────────────────────────
  members_page_header: {
    title:    'For Members',
    subtitle: 'Services, CPE and resources for Chartered Accountants',
  },
  members_icai_banner: {
    body:         'All member services, UDIN, COP and CPE records are managed at the **official ICAI portal** (ICAI SSP sign-in required).',
    button_label: 'Visit ICAI Members Portal',
    button_url:   'https://www.icai.org/members',
  },
  members_quick_access: {
    directory_label:   "Members' Directory",
    jobs_label:        'Job Vacancies',
    assignments_label: 'Assignment Openings',
  },
  members_services: {
    card_1_title: 'COP Renewal · Restoration · Firm Registration',
    card_1_desc:  'Self-service Certificate of Practice workflows on ICAI eServices.',
    card_2_title: 'UDIN Generation & Verification',
    card_2_desc:  'Generate and verify Unique Document Identification Numbers on the ICAI UDIN portal.',
    card_3_title: 'Newsletter Archive & Article Submission',
    card_3_desc:  'Read past issues of the Nagpur Branch monthly newsletter — and submit your own article to be featured in an upcoming issue.',
    card_4_title: 'Event Attendance Certificates',
    card_4_desc:  'Download attendance certificates for events you have participated in.',
  },
  // ── Contact page defaults ───────────────────────────────────────────
  contact_page_header: {
    title:    'Contact the Branch',
    subtitle: 'Raise a grievance, share a suggestion, or send a general query. We aim to respond within 48 hours.',
  },
  contact_sections: {
    info_card_title:      'ICAI Bhawan, Nagpur',
    track_link_label:     'Track an existing ticket →',
    form_card_title:      'Send a message',
    submit_button_label:  'Send message',
    submit_busy_label:    'Sending…',
    success_message:      "Thanks — your message has been logged. Reference: **{ticketNo}**. A confirmation has been emailed to {email}.",
    track_button_label:   'Track this ticket',
    another_button_label: 'Submit another',
  },
  // ── Resources page defaults ─────────────────────────────────────────
  resources_page_header: {
    title:    'Resources',
    subtitle: 'Standards, circulars, newsletters and downloadable presentations.',
  },
  resources_categories: {
    card_1_title: 'Circulars',
    card_1_desc:  'ICAI announcements, notifications and council decisions.',
    card_1_url:   'https://www.icai.org/category/announcements',
    card_2_title: 'Standards on Auditing (SA)',
    card_2_desc:  'ICAI-issued Standards on Auditing — planning, evidence, reporting and quality.',
    card_2_url:   'https://www.icai.org/post/standards-on-auditing',
    card_3_title: 'Accounting Standards (AS / Ind AS)',
    card_3_desc:  'Accounting Standards and Ind AS notified for entities in India.',
    card_3_url:   'https://www.icai.org/post/accounting-standards',
    card_4_title: 'e-Journal Archive',
    card_4_desc:  'Browse The Chartered Accountant journal archives.',
    card_4_url:   'https://www.icai.org/category/e-journal',
  },
  resources_sections: {
    newsletter_eyebrow:    'Monthly',
    newsletter_heading:    'Branch Newsletter',
    newsletter_subtitle:   'The Nagpur Branch monthly newsletter — events recap, articles, member updates.',
    newsletter_empty_msg:  'No newsletters published yet.',
    ejournal_eyebrow:      'Branch publication',
    ejournal_heading:      'e-Journal Archive',
    ejournal_subtitle:     'Long-form articles authored by the Nagpur Branch — quarterly and special issues.',
    papers_eyebrow:        'Seminars & Conferences',
    papers_heading:        'Paper Presentations',
    papers_subtitle:       'Presentations and papers from past conferences and seminars held at the Nagpur Branch.',
    papers_search_placeholder: 'Search title, abstract or speaker…',
    papers_disclaimer:     '**Disclaimer:** The views expressed in these presentations are of the Speaker himself/herself. The Institute of Chartered Accountants of India does not subscribe to his/her views.',
  },
  // ── Pragyaan landing defaults ───────────────────────────────────────
  praygyaan_page_header: {
    title:    'Pragyaan — AI Assistant',
    subtitle: 'Your 24×7 grounded guide to ICAI Nagpur Branch services, events, circulars, and resources.',
  },
  praygyaan_features: {
    card_1_title: 'Source-cited answers',
    card_1_desc:  'Every reply cites the branch document or page it relied on.',
    card_2_title: 'Smart, scoped search',
    card_2_desc:  'Searches branch circulars, events, FAQs and resources for you.',
    card_3_title: 'English · हिन्दी · मराठी',
    card_3_desc:  'Ask in your language — Pragyaan replies in the same one.',
    welcome:      "Namaste! I'm **Pragyaan**, the ICAI Nagpur Branch AI assistant. Ask me about CPE events, articleship, UDIN, branch services, circulars, professional standards, and more — I answer from the branch knowledge base and cite my sources.",
    input_placeholder:           'Ask Pragyaan a question…',
    input_placeholder_streaming: 'Pragyaan is replying…',
    send_label:                  'Send',
    send_label_streaming:        'Replying…',
    chat_title:                  'Chat with Pragyaan',
    reply_in_label:              'Reply in',
    starters_prefix:             'Try:',
  },
  // ── Events page defaults ────────────────────────────────────────────
  events_page_header: {
    title:                       'Events & CPE',
    subtitle:                    'Upcoming programmes across all committees',
    committee_subtitle_template: 'Upcoming events from the {short} committee',
  },
  events_audience_tabs: {
    all_label:      'All Events',
    members_label:  'For Members',
    students_label: 'For Students',
  },
  events_sections: {
    events_eyebrow:        'EVENTS',
    events_title:          'Upcoming programmes and Events',
    upcoming_eyebrow:      'UPCOMING EVENTS',
    view_list_label:       'List',
    view_month_label:      'Month',
    committees_eyebrow:    'BROWSE BY COMMITTEE',
    committees_title:      'Committee categories',
    committees_subtitle:   'Select a committee to open its dedicated page with every upcoming event.',
    empty_audience_msg:    'No upcoming events for this audience right now.',
    empty_committee_msg:   'No upcoming events for this committee right now. Check back soon.',
    all_committees_btn:    'All committees',
  },
  events_committee_fallback: {
    image_url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&h=420&q=80&auto=format&fit=crop',
  },
  // ── Announcements page defaults ─────────────────────────────────────
  announcements_page_header: {
    title:               'Announcements',
    subtitle:            'Latest updates from ICAI Nagpur Branch — events, circulars, deadlines, and important notices.',
    empty_state_heading: 'No active announcements right now',
    empty_state_body:    'Check back soon — branch updates, events, and circulars will appear here.',
  },
  // ── Members directory defaults ──────────────────────────────────────
  members_directory_page_header: {
    title:               "Members' Directory",
    subtitle:            'Nagpur Branch — registered members list',
    confidential_notice: '**Confidential:** This directory is restricted to members under the jurisdiction of the Nagpur Branch. Do not share or reproduce member contact details outside authorised use.',
    signin_notice_title: 'Sign in to see contact details.',
    signin_notice_body:  "You're viewing the public roster. Members can sign in to access phone, email and firm information.",
  },
  // ── Photo gallery defaults ──────────────────────────────────────────
  photo_gallery_page_header: {
    title:    'Photo Gallery',
    subtitle: 'Event photos from programmes organised by the Nagpur Branch',
  },
  // ── Job vacancies defaults ──────────────────────────────────────────
  job_vacancies_page_header: {
    job_title:            'Job Vacancies',
    job_subtitle:         'Member job opportunities in Nagpur / Vidarbha region',
    articleship_title:    'Articleship Vacancies',
    articleship_subtitle: 'Articleship openings posted by member firms in Nagpur / Vidarbha',
    assignment_title:     'Assignment Openings',
    assignment_subtitle:  'Short-term and freelance engagements posted by member firms — audit assistance, due-diligence, GST/tax projects and consulting work.',
    notice:               '**Notice:** These postings are made by member firms and organisations in Nagpur / Vidarbha region. The branch does not verify or endorse any posting. Contact the respective firm directly for enquiries.',
  },
  // ── Track grievance defaults ────────────────────────────────────────
  track_grievance_page_header: {
    title:    'Track your grievance',
    subtitle: 'Enter your ticket number and the email you submitted with to see the current status.',
  },
  // ── My Library defaults ─────────────────────────────────────────────
  my_library_page_header: {
    title:    'My Library',
    subtitle: 'Your saved papers and CPE history.',
  },
  // ── Room booking defaults ───────────────────────────────────────────
  room_booking_page_header: {
    title:    'Room Booking',
    subtitle: 'Reserve a room at ICAI Bhawan, Nagpur',
  },
  // ── Search defaults ─────────────────────────────────────────────────
  search_page_header: {
    title:             'Search',
    subtitle_idle:     'Search events, services and resources',
    subtitle_template: 'Results for "{query}"',
    placeholder:       'Search…',
    submit_label:      'Search',
    empty_state:       'No events matched "{query}". Try the events page or browse by committee.',
  },
  // ── Mock tests defaults ─────────────────────────────────────────────
  mock_tests_page_header: {
    title:               'Mock tests',
    subtitle:            'WICASA-organised mock papers — register, download practice material, see results.',
    my_section_heading:  'My mock tests',
    upcoming_heading:    'Upcoming & open',
    results_heading:     'Recent results',
    empty_msg:           'No mock tests scheduled for this level right now.',
    level_label:         'Level:',
  },
  // ── CABF defaults ───────────────────────────────────────────────────
  benevolent_fund_content: {
    title:    'CA Benevolent Fund',
    subtitle: 'Financial relief for members and their families in distress.',
    about_heading:      'About CABF',
    about_body:         'The Chartered Accountants Benevolent Fund (CABF) provides financial assistance to members and their dependents in case of distress, illness or untimely demise. The fund is administered by the ICAI Head Office; the Nagpur branch facilitates contributions and disbursement requests.',
    contribute_heading: 'Contribute',
    contribute_body:    'Contributions are eligible for deduction under Section 80G. Suggested slabs:',
    slabs_csv:          '₹100; ₹500; ₹1,000; ₹10,000',
    alert_body:         '**Online contributions open soon.** In the meantime, contribute via the official ICAI CABF portal or contact the Nagpur branch directly.',
    icai_btn_label:     'ICAI CABF (HQ) ↗',
    icai_btn_url:       'https://cabf.icai.org/',
    contact_btn_label:  'Contact Nagpur Branch',
  },
  // ── CA 2.0 defaults ─────────────────────────────────────────────────
  ca2_vision_content: {
    title:        'CA 2.0 — Life After Office',
    subtitle:     'A meaningful second innings for senior CAs',
    intro:        "CA 2.0 is the Nagpur Branch's flagship vision for senior chartered accountants — a community programme that combines wellness, mentorship and hobby circles, ensuring that veterans of the profession continue to live a meaningful, engaged and joyful life after retirement from active practice.",
    card_1_title: 'Wellness circles',
    card_1_desc:  'Yoga, walks, health camps and mental wellness sessions.',
    card_2_title: 'Mentor a junior',
    card_2_desc:  'Structured 6-month mentor pairing with juniors and students.',
    card_3_title: 'Hobby clubs',
    card_3_desc:  'Music, theatre, painting, photography — pick your circle.',
  },
  // ── Investor Awareness defaults ─────────────────────────────────────
  investor_awareness_content: {
    title:            'Investor Awareness',
    subtitle:         'Free programmes promoting financial literacy and safe investing.',
    intro:            'The branch conducts public investor awareness programmes in association with regulators and industry bodies to promote financial literacy, safe investing, fraud awareness and basic personal finance for students, salaried individuals and senior citizens.',
    sessions_heading: 'Upcoming sessions',
    sessions_body:
`- **Financial Planning for Young Professionals** — 12 May · ICAI Bhawan
- **Beware of Online Investment Frauds** — 19 May · Online
- **Senior Citizens' Money Health** — 26 May · Chitnavis Centre`,
  },
  // ── Career Counselling defaults ─────────────────────────────────────
  career_counselling_content: {
    title:    'Career Counselling',
    subtitle: 'One-to-one sessions with volunteer CAs and alma-mater mentors — launching soon.',
    benefits_heading:       "What you'll get",
    benefits_body:
`- A 30-minute Session with a practising CA
- Help with articleship, exams and career paths
- Optional follow-up over email`,
    bookings_heading:       'Bookings open soon',
    bookings_body:          "The Nagpur Branch is onboarding its volunteer counsellor panel for this term. Once the roster is in place, you'll be able to pick a counsellor and a time slot directly from this page. We'll announce the launch in the branch newsletter and via the homepage announcement ticker.\n\nNeed career guidance now? Reach out via the contact form and we'll route your request to the right person at the branch.",
    contact_button_label:   'Open the contact form',
  },
  // ── Auth defaults ───────────────────────────────────────────────────
  auth_login: {
    title:    'Welcome back',
    subtitle: 'Sign in to your ICAI Nagpur Branch account.',
  },
  auth_signup: {
    title:    'Create your account',
    subtitle: 'Join the ICAI Nagpur Branch community.',
  },
  auth_forgot: {
    title:    'Reset your password',
    subtitle: "We'll email you a link to set a new one.",
  },
  // ── Footer defaults ─────────────────────────────────────────────────
  footer_content: {
    brand_name:            'ICAI Nagpur Branch',
    brand_description:     'Branch of WIRC of The Institute of Chartered Accountants of India.',
    quick_links_heading:   'Quick Links',
    initiatives_heading:   'Initiatives',
    icai_portals_heading:  'ICAI Portals',
  },
  // ── Pragyaan FAQ defaults ───────────────────────────────────────────────
  // Backs the starter chips Pragyaan suggests. Bodies are markdown with one
  // H3 per question — chunker keeps them paragraph-aligned, retrieval picks
  // the right one. Admin can override any slot via /admin/site-content.
  faq_branch_services: {
    body:
`### How do I register for a branch event?
Open the **Events** page from the top nav, pick the event you want, and click **Register**. CPE events show the fee and seat availability inline. Logged-in members can pay by card or UPI; receipts and the e-ticket are emailed.

### Where can I find the latest branch newsletter?
The most recent issue is on the **Newsletter** page. Past issues are linked from the same page in reverse-chronological order — open any to read or download the PDF.

### How do I contact the branch office?
The **Contact** page lists the branch address, phone, email and Google Maps location. Office hours are Mon–Sat 10:30–18:00. For event-specific queries, the event page lists the committee owner; for grievances, use the **Grievance form** on the Contact page (48-hour SLA).

### How do I download my event attendance certificate?
Once the branch closes attendance for an event, an attendance certificate becomes available on your dashboard. Open the **My upcoming events** section on your dashboard for the download link.`,
  },
  faq_for_members: {
    body:
`### What member benefits does the branch provide?
Every Nagpur Branch member gets:
- **Member-only rates** on branch programmes (typically 30–50% off the public fee)
- **Free access** to the branch library (4,200+ titles) and reading room
- **Networking events** — annual members' meet, Sports day, family events
- **Empanelment opportunities** circulated when assignments come in
- **CABF assistance** (Chartered Accountants Benevolent Fund) for members and their families in distress
- **Mentoring/guidance** for new practitioners through the Members in Industry & Practice cells
- **Curated knowledge digests** on tax, audit and regulatory updates emailed monthly

### How do I update my membership details?
Personal details (address, phone, email, firm) are maintained on the **ICAI Self-Service Portal** (eservices.icai.org). Log in with your member ID → *Edit Member Profile*. Changes propagate to the branch within 24 hours. For corrections to records the branch holds locally, email the branch office or raise a grievance.

### Where are the latest professional standards circulars?
The **Resources** section on the branch portal mirrors the head-office Professional Standards, Auditing & Accounting, and Direct/Indirect Tax circulars the branch has formally summarised for members. For the authoritative original notification, follow the link to icai.org. The branch newsletter also flags the month's most important regulatory changes on page 1.

### How do I download my event attendance certificate?
Once the branch closes attendance for an event, an attendance certificate becomes available on your dashboard. Open the **My upcoming events** section on your dashboard for the download link.`,
  },
  faq_for_students: {
    body:
`### What are the articleship registration steps?
1. Clear **CA Foundation** (or qualify via direct-entry route).
2. Complete **ICITSS — Orientation + ITT** (15 days each) before joining a principal. The branch runs ITT/Orientation batches every month — check the **Events** page for the next batch.
3. Find a principal (CA in practice) and execute **Form 102/103** within 30 days of joining.
4. Submit Form 103 to the Regional Office (WIRC) along with proof of ICITSS, your registration fee and the principal's declaration.
5. The branch helps with form review and submission — bring your documents to the office Mon–Sat 10:30–18:00.

### When are the next CA exam dates?
ICAI conducts CA Foundation, Intermediate and Final exams in **May and November** every year. Exact dates are notified by the Examination Department (icai.org/exam) about 4 months before each cycle. The branch republishes the dates on the homepage ticker and on the **Announcements** page as soon as the head office notifies them.

### What student resources does the branch offer?
- **Mock test series** before every exam cycle — both physical (at the branch) and online
- **Subject-wise revision lectures** by senior faculty
- **WICASA** (Western India Chartered Accountants Students Association) — sports, cultural and academic events
- **Career counselling** sessions for new entrants
- **Free reading room** access (80 seats) and a digital library
- **Articleship matchmaking** — student-employer registry maintained by the branch
- Past test papers, suggested answers and study materials in the **Resources** section

### How do I get my ITT/Orientation certificate?
- **ITT/Orientation completion (students)** — certificates are issued by the branch on completion; a digital copy is emailed and a physical one is available at the branch office. Lost certificate? Raise a grievance with your batch dates.`,
  },
  faq_for_employers: {
    body:
`### How can my firm post a job opening?
Verified employers (CA firms and corporates) can post openings via the **Employer Portal** — log in, click **Post a Job**, and submit the role description, vacancy count, location, qualification, experience band and the closing date. Postings are reviewed by the branch within one working day and stay live for 30 days (extendable). A per-post fee applies; the current fee schedule is shown on the post-creation page.

### How do I recruit articled assistants through the branch?
1. **Verify your firm** with the branch (one-time KYC — proof of firm registration + principal's ICAI number).
2. List your **Articleship vacancies** under the same Employer Portal — separate flow from full-time roles.
3. Browse the **Student Registry** — students who've completed ICITSS and are looking for placement.
4. Use the in-app messaging to schedule interviews and exchange Form 102.
5. The branch runs **campus drives** during ITT batches — register your firm to participate.

### What employer services does the branch offer?
- **Job-posting platform** (jobs + articleship vacancies)
- **Verified-employer badge** after one-time KYC
- **Empanelment listings** — branch-curated assignments for empanelled firms
- **Member directory access** for empanelling associates/consultants
- **CPE programme sponsorship** — branded sessions for your team at the branch
- **Annual employer meet** — networking with the active practitioner community
For pricing and to begin verification, contact the branch office (Contact page).`,
  },
  // added from DB
  about_committee_members: {
    members: [
      {
        name: 'CA Swaroopa Wazalwar',
        user_id: '8b044603-c0e6-4435-9f85-f9f091aa3508',
        photo_url: 'https://ohpjavugvpqjbloxzluf.supabase.co/storage/v1/object/public/public-content/site/fd26e683-cdea-4b90-b9ed-900c4b234a5e.webp',
        designation: 'Chairperson',
        committee_roles: [
          {
            code: 'branch_chairman',
            label: 'Chairperson',
          },
          {
            code: 'mcm',
            label: 'Managing Committee Member',
          },
        ],
      },
      {
        name: 'CA Deepak Jethwani',
        user_id: '175eb83c-ed47-4ab7-b342-f9e25556b26a',
        photo_url: 'https://ohpjavugvpqjbloxzluf.supabase.co/storage/v1/object/public/public-content/site/7ddbc6d4-ccb8-4ae1-8d06-553606e82783.webp',
        designation: 'Vice Chairperson',
        committee_roles: [
          {
            code: 'branch_vice_chairman',
            label: 'Vice Chairperson',
          },
          {
            code: 'mcm',
            label: 'Managing Committee Member',
          },
        ],
      },
      {
        name: 'CA Trupti Bhattad',
        user_id: '91988735-e4e8-4914-a6b6-d42f41bd90c9',
        photo_url: 'https://ohpjavugvpqjbloxzluf.supabase.co/storage/v1/object/public/public-content/site/f46b5244-f0d5-4161-bb4b-68ef80a901a9.webp',
        designation: 'Secretary',
        committee_roles: [
          {
            code: 'branch_secretary',
            label: 'Secretary',
          },
          {
            code: 'mcm',
            label: 'Managing Committee Member',
          },
        ],
      },
      {
        name: 'CA Vinod Vijay Agrawal',
        user_id: 'd35031d5-16ff-4e13-b4c6-65dffa62cc2d',
        photo_url: 'https://ohpjavugvpqjbloxzluf.supabase.co/storage/v1/object/public/public-content/site/ce2d2dc5-b6a9-4fdc-9649-840159f7dc9c.webp',
        designation: 'Treasurer',
        committee_roles: [
          {
            code: 'branch_treasurer',
            label: 'Treasurer',
          },
          {
            code: 'mcm',
            label: 'Managing Committee Member',
          },
        ],
      },
      {
        name: 'CA Dinesh Rathi',
        user_id: '0b95613e-4e61-4433-b696-ae760464b1a3',
        photo_url: 'https://ohpjavugvpqjbloxzluf.supabase.co/storage/v1/object/public/public-content/site/ddc7c867-1d72-4ae2-a064-37e7134f482e.webp',
        designation: 'Managing Committee Member',
        committee_roles: [
          {
            code: 'mcm',
            label: 'Managing Committee Member',
          },
        ],
      },
      {
        name: 'CA Ankush Kesharwani',
        user_id: '419c9d0a-507a-40e4-bb44-d7ac2c13114c',
        photo_url: 'https://ohpjavugvpqjbloxzluf.supabase.co/storage/v1/object/public/public-content/site/f44f20f4-9acb-4997-ae66-2d295c6ce1af.webp',
        designation: 'Managing Committee Member',
        committee_roles: [
          {
            code: 'mcm',
            label: 'Managing Committee Member',
          },
        ],
      },
      {
        name: 'CA Ashish Agarwal',
        user_id: 'b7db44b9-af11-4bdb-bc7e-b50769e1abac',
        photo_url: 'https://ohpjavugvpqjbloxzluf.supabase.co/storage/v1/object/public/public-content/site/f8f57a09-8fa4-43d7-a4ad-a95a4dc06cef.webp',
        designation: 'Managing Committee Member',
        committee_roles: [
          {
            code: 'mcm',
            label: 'Managing Committee Member',
          },
        ],
      },
      {
        name: 'CA Pranavkumar Limaja',
        user_id: 'dfb4f24e-388b-4f05-8fb7-86fcfd0c2052',
        photo_url: 'https://ohpjavugvpqjbloxzluf.supabase.co/storage/v1/object/public/public-content/site/4214d6bb-5a0d-4ef8-b333-135e7fc3e49d.webp',
        designation: 'Managing Committee Member',
        committee_roles: [
          {
            code: 'mcm',
            label: 'Managing Committee Member',
          },
        ],
      },
      {
        name: 'CA Jiten Saglani',
        user_id: 'b2714c15-e84b-4e1e-8152-bbb88d923682',
        photo_url: 'https://ohpjavugvpqjbloxzluf.supabase.co/storage/v1/object/public/public-content/site/10392d2b-2365-428a-a484-9aaae4188f5a.webp',
        designation: 'Managing Committee Member',
        committee_roles: [
          {
            code: 'mcm',
            label: 'Managing Committee Member',
          },
        ],
      },
      {
        name: 'CA Pratik Palan',
        user_id: '728c14ba-0dc8-4ddb-9bc6-7103d2100f70',
        photo_url: 'https://ohpjavugvpqjbloxzluf.supabase.co/storage/v1/object/public/public-content/site/31cbb806-af1f-4765-9267-1fd85dced41b.webp',
        designation: 'Managing Committee Member',
        committee_roles: [
          {
            code: 'mcm',
            label: 'Managing Committee Member',
          },
        ],
      },
    ],
  },
};

// Internal — fetch the bundle once per ~5 min. EventsPage, HomePage and
// AboutPage all share this one cache entry.
//
// To kill the "flash of default content" on refresh, we ALSO persist the
// last successful response in localStorage. On reload we hydrate from
// localStorage synchronously (no flash), then refetch in the background
// and refresh the cache + UI when newer data arrives.
//
// `loaded` distinguishes between "we have data to show (whether from
// cache or network)" and "still waiting for the very first response on
// a brand-new install" — pages can render shimmers in the latter case
// instead of falling back to the baked-in default copy that caused the
// flash.

const SITE_CONTENT_LS_KEY = 'icai-site-content-cache-v1';

function readPersistedSiteContent() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SITE_CONTENT_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Sanity-check the shape so a corrupted/old payload doesn't crash render.
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.rows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersistedSiteContent(payload) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SITE_CONTENT_LS_KEY, JSON.stringify(payload));
  } catch { /* quota / incognito — silently skip, in-memory state still works */ }
}

function useAllSiteContent() {
  // Hydrate synchronously from localStorage on first render. This is the
  // bit that eliminates the flash — the very first React paint already
  // has the data from the user's previous visit.
  const [data, setData] = useState(() => readPersistedSiteContent());
  // Bumped by the invalidation subscription so admin edits reflect in
  // place — otherwise the useEffect below only ran once per mount.
  const [nonce, setNonce] = useState(0);

  useEffect(() => subscribe('/api/site/content', () => setNonce((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;
    cachedGet('/api/site/content', null, 300_000)
      .then((j) => {
        if (cancelled) return;
        setData(j);
        writePersistedSiteContent(j);
      })
      .catch(() => {
        // Network failed — keep whatever we already had (cached or null).
        // Only fall through to an empty payload if we have nothing at all,
        // so a stale-but-real cache wins over a fresh empty one.
        if (cancelled) return;
        setData((prev) => prev ?? { rows: [] });
      });
    return () => { cancelled = true; };
  }, [nonce]);

  return data;
}

// Returns merged { default, ...db } payload for a single slot.
//
// `loaded` is true once we have data from either localStorage or the
// API; while loaded is false, callers can render a shimmer instead of
// the hardcoded defaults so the page doesn't show stale copy that
// immediately gets replaced.
//
// The hardcoded defaults still serve as a final safety net: if the DB
// has nothing for this slug (fresh install) AND no cached data exists,
// the defaults render so the page never shows blank text.
export function useSiteContent(slug) {
  const all = useAllSiteContent();
  const loaded = all !== null;

  return useMemo(() => {
    const fallback = SITE_CONTENT_DEFAULTS[slug] || {};
    const row = all?.rows?.find((r) => r.slug === slug);
    const data = row?.data || {};
    // Shallow merge — fallback fills gaps when the DB row is partial
    // (e.g. admin set the quote but didn't upload a photo yet).
    const merged = { ...fallback, ...data };
    Object.defineProperty(merged, '_loaded', { value: loaded, enumerable: false });
    return merged;
  }, [all, loaded, slug]);
}

// Helper: returns true once the site-content bundle has been delivered
// either from localStorage cache or the network. Pages can use this to
// decide whether to render a shimmer or the real content.
export function useSiteContentLoaded() {
  return useAllSiteContent() !== null;
}
