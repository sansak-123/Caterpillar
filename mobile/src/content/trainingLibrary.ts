/**
 * Operator-first training content for the in-cab library. These are short,
 * practical lessons for a supervised learner; the machine manufacturer manual,
 * site rules, lift plan and a competent trainer always take precedence.
 *
 * `videoUri` holds a real YouTube video ID (not a fabricated placeholder) for the
 * handful of lessons where a genuinely appropriate, verified official/reputable video
 * exists — sourced from Caterpillar's own channel, equipment-manufacturer training
 * series, or established industrial safety-training publishers, confirmed via
 * YouTube's oEmbed API before being added here. Most lessons have none: we would
 * rather show "text lesson" honestly than attach an irrelevant or low-quality video
 * just to fill the field.
 */

export type LessonCategory = "safety" | "efficiency" | "compliance" | "onboarding" | "skill";
export type LessonLevel = "beginner" | "foundation" | "practice";

export type Lesson = {
  id: string;
  title: string;
  category: LessonCategory;
  level: LessonLevel;
  durationMin: number;
  languages: ("en" | "hi" | "ta")[];
  summary: string;
  objective: string;
  keySteps: string[];
  /** Full reading content — the actual lesson body, not just the card preview. */
  body: string[];
  standardRef?: string;
  downloadedOffline: boolean;
  /** A YouTube video ID, e.g. "dQw4w9WgXcQ" — see file header. */
  videoUri: string | null;
  /** Attribution shown under an embedded video — required whenever videoUri is set. */
  videoSource?: string;
};

const allLanguages: Lesson["languages"] = ["en", "hi", "ta"];

export const trainingLibrary: Lesson[] = [
  {
    id: "welcome-to-operatoros",
    title: "Start Here: Your First Safe Shift",
    category: "onboarding",
    level: "beginner",
    durationMin: 4,
    languages: allLanguages,
    summary: "A new operator's map of the day: inspect, plan, operate, pause safely, report hazards, and hand over cleanly.",
    objective: "Know the safe sequence of a shift and when to stop and ask for help.",
    keySteps: ["Read the task and hazards before starting", "Complete the walkaround", "Use the seatbelt and three-point contact", "Stop work for an unknown hazard or unsafe condition"],
    body: [
      "Every shift on a CAT machine follows the same basic shape, whether you're excavating a trench or loading trucks all day: inspect the machine, understand the task, operate within what you and the site have controlled for, pause safely when something changes, report what you find, and hand over cleanly to whoever comes next. Learning that shape now, before the details of any one machine or task, gives you a mental checklist that works everywhere.",
      "Inspection comes first because a defect found on the ground costs you a delay; the same defect found mid-task can cost a lot more. The pre-start walkaround (its own lesson in this library) is not a formality — it is the fastest, cheapest safety check you will do all day.",
      "Understanding the task means more than knowing where to dig. Your task card lists depth, hazards, and known site conditions for a reason: it is the instruction sheet, not just a schedule entry. If anything on it conflicts with what you see on the ground, the ground wins — stop and ask before proceeding.",
      "Operating within limits means respecting the proximity zones, seatbelt rules, and slope thresholds this app enforces automatically, and treating them as protection rather than as friction. None of them are trying to slow you down for its own sake.",
      "Finally, a clean handover — an accurate end-of-shift log with real hours, fuel, and any defects noted — is a gift to the next operator. It is also, not incidentally, the fastest way to avoid being blamed for a problem you didn't cause.",
    ],
    downloadedOffline: true,
    videoUri: null,
  },
  {
    id: "cab-controls-and-visibility",
    title: "Know Your Cab: Controls, Mirrors and Visibility",
    category: "onboarding",
    level: "beginner",
    durationMin: 6,
    languages: allLanguages,
    summary: "Learn the purpose of primary controls, display warnings, mirrors/cameras, horn and emergency stop before moving a machine.",
    objective: "Set up the cab so you can see, reach and respond safely.",
    keySteps: ["Adjust seat, mirrors and camera view", "Locate horn, emergency stop and fire extinguisher", "Check warning lamps before travel", "Never operate a control you do not understand"],
    body: [
      "Before you move a machine an inch, the cab itself needs to be set up for you specifically. A seat position adjusted for the previous operator can put you out of comfortable reach of a pedal or lever exactly when you need it fastest.",
      "Mirrors and cameras exist because no cab gives a full 360° view — ISO 5006, the standard governing operator field of view for earth-moving machinery, explicitly assumes blind zones exist and requires mirrors/cameras to cover as much of them as practical. Adjusting these at the start of your shift, not once a week, is what keeps that coverage real.",
      "Locate the horn, the emergency stop, and the fire extinguisher before you need them, not while you need them. In a genuine emergency you will not have time to search — your hand should already know where to go.",
      "Warning lamps on the instrument panel are not decorative. A lamp you don't recognize is a question to answer before travel, not after.",
      "The single most important rule in this lesson: never operate a control whose function you are not certain of. Ask your trainer or check the machine-specific operator manual first. Curiosity is how operators get hurt on unfamiliar equipment.",
    ],
    standardRef: "Follow the machine-specific operator manual",
    downloadedOffline: true,
    videoUri: "NqAoqzBGL58",
    videoSource: "Cat® Products — \"Basic Operations - Cat® Mini Hydraulic Excavator\"",
  },
  {
    id: "safe-entry-exit",
    title: "Safe Entry and Exit: Three Points of Contact",
    category: "safety",
    level: "beginner",
    durationMin: 3,
    languages: allLanguages,
    summary: "Falls happen before work begins. Practise facing the machine, using handholds, clearing mud, and never jumping from the cab.",
    objective: "Enter and exit without a slip, fall or unintended control movement.",
    keySteps: ["Face the machine", "Keep three points of contact", "Clean boots and steps", "Use designated access points only"],
    body: [
      "It's a strange fact of heavy-equipment safety that a meaningful share of injuries happen before the engine is even running — mounting and dismounting the machine. A fall from a track or a step, at height, onto uneven ground, is a genuinely serious injury waiting to happen, and it is entirely preventable.",
      "The rule is three points of contact at all times: two hands and one foot, or two feet and one hand, in contact with the machine's designated handholds and steps throughout the climb. This means facing the machine while climbing — not facing outward — and never carrying tools or materials in a hand you need for a handhold.",
      "Mud, oil, and ice on boots and steps are the most common reason a good grip fails anyway. Clear both before you climb, not after you slip.",
      "Never jump down from a cab or track, however small the drop looks. A twisted ankle from a routine dismount is one of the most common and most avoidable injuries on any site.",
      "Use only the access points the manufacturer designed for entry — not a bucket, not an attachment, not a convenient-looking ledge. They were not built to bear your weight repeatedly and safely.",
    ],
    downloadedOffline: true,
    videoUri: "ek94mVktpXs",
    videoSource: "Vector Solutions Industrial — \"Mounting and Dismounting Heavy Equipment Training\"",
  },
  {
    id: "pre-start-checklist-walkthrough",
    title: "Pre-Start Walkaround Checklist",
    category: "compliance",
    level: "beginner",
    durationMin: 6,
    languages: allLanguages,
    summary: "A practical walkaround covering leaks, hoses, tracks/tyres, attachments, guards, lights, alarms, fluids and the work area.",
    objective: "Find defects before they become breakdowns or injuries.",
    keySteps: ["Walk one consistent route around the machine", "Look for leaks, damage and loose parts", "Test alarms and lights from a safe position", "Tag out and report a critical defect"],
    body: [
      "The pre-start walkaround replaces the paper checklist your site used to run on — the same items, done the same way, but on your device and feeding straight into the record instead of a clipboard nobody reads again. It exists because a five-minute look now is dramatically cheaper than a breakdown or an injury later.",
      "Walk the same route every time, in the same direction. A consistent pattern is what actually catches problems — a random glance around the machine reliably misses things a routine won't.",
      "You're looking specifically for fluid leaks (fresh stains under the machine are the giveaway), damaged or worn hoses, track or tyre condition and pressure, loose or missing guards, and anything visibly bent, cracked, or out of place on the attachment.",
      "Test the horn, reverse alarm, and lights from a position where you won't be struck if something moves unexpectedly — never from directly in front of or behind the machine.",
      "If you find a genuine defect — not a cosmetic scratch, but something that affects safety or function — tag the machine out and report it immediately rather than deciding to \"keep an eye on it\" for the shift. That decision isn't yours to make alone.",
    ],
    downloadedOffline: true,
    videoUri: "0bAw7J7gHD0",
    videoSource: "Cat® Products — \"Cat® Excavator Daily Walkaround Inspection\"",
  },
  {
    id: "seatbelt-rops-5s",
    title: "Seatbelt and ROPS: Why It Matters",
    category: "safety",
    level: "beginner",
    durationMin: 4,
    languages: allLanguages,
    summary: "The rollover protective structure protects the space around you only when the belt keeps you inside that space.",
    objective: "Use the seatbelt correctly before engine start and understand the moving-machine alert.",
    keySteps: ["Fasten and check the belt before moving", "Do not bypass belt switches", "Stop safely if a belt warning appears", "Report damaged belts or buckles"],
    body: [
      "The ROPS — rollover protective structure — on your machine is engineered and tested to ISO 3471's static stability requirements to preserve a survivable space around the operator's seat if the machine tips over. That protection has one condition built into it: you have to actually be inside that space when it happens, which is the entire job of the seatbelt.",
      "This is why this app's seatbelt alert only fires as a loud, interrupting alert once the machine is moving or swinging with the belt off for more than five seconds — it isn't policing you for sitting still with the belt off; it's making sure you're inside the ROPS zone the moment the machine can actually roll or the belt is needed.",
      "OSHA 29 CFR 1926.602 makes seatbelt use a compliance requirement on earthmoving equipment for exactly this reason, and ISO 6683 sets the engineering standard the belt itself has to meet.",
      "Never disable, bypass, or defeat a seatbelt switch, however inconvenient it feels for a particular task. If a belt or buckle is damaged, report it and get it fixed — a belt that doesn't lock properly gives you the feeling of protection without the reality of it.",
    ],
    standardRef: "OSHA 29 CFR 1926.602; ISO 3471 (ROPS); ISO 6683 (seatbelts)",
    downloadedOffline: true,
    videoUri: "sdMTxG5yDE0",
    videoSource: "Cat® Products — \"Safety Basics: Seat Belts\"",
  },
  {
    id: "reading-task-cards",
    title: "Reading Your Daily Task Card",
    category: "onboarding",
    level: "beginner",
    durationMin: 4,
    languages: allLanguages,
    summary: "Understand task location, depth, hazards, weather, P50/P90 time range and the voice read-out before you begin.",
    objective: "Turn a work order into a clear, safe plan.",
    keySteps: ["Confirm what, where and how deep", "Read hazard callouts aloud if needed", "Treat P90 as planning support, not pressure", "Ask when instructions conflict with site conditions"],
    body: [
      "A task card in this app is designed to be an instruction sheet, not just a line on a schedule — it should tell you what to dig, where, how deep, and what hazards are already known before you arrive, in your own language if you'd rather hear it than read it.",
      "Start by confirming the basics match what you actually see: the location, the depth target, and the machine assigned. A mismatch between the card and the ground is worth raising before you start, not after.",
      "Hazard callouts — buried utilities, nearby workers, slope conditions — are there because they were known ahead of time, not because they're guaranteed to be the only hazards present. Use them as a starting checklist, not a complete one.",
      "The time range you see (P50–P90) is a fair estimate built from real history, weather, and machine condition — not a stopwatch used against you. P90 in particular exists to give you a realistic worst case for planning, especially in rain, wind, or with a less familiar machine.",
      "If anything about the instructions conflicts with what you find on site — an unmarked hazard, ground that doesn't match the plan, a task that doesn't make sense — stop and ask before proceeding. The task card is a starting point, not a substitute for judgment.",
    ],
    downloadedOffline: true,
    videoUri: null,
  },
  {
    id: "reading-blind-spots",
    title: "Reading Your Machine's Blind Spots",
    category: "safety",
    level: "foundation",
    durationMin: 6,
    languages: allLanguages,
    summary: "Excavators, loaders and dozers lose sight of different areas. Learn where cameras help and where a spotter is still essential.",
    objective: "Identify blind zones before swing, travel, reverse or loading work.",
    keySteps: ["Know your machine's blind-spot map", "Scan mirrors and cameras before movement", "Use an agreed spotter signal", "Stop immediately when you lose sight of a person"],
    body: [
      "Every class of CAT machine has a different, well-documented blind-spot shape under ISO 5006, and the shape matters: an excavator's biggest blind zone is typically the rear arc during a swing, a wheel loader's is usually directly in front behind a raised bucket, and a dozer's is a wide rear zone behind the blade and counterweight.",
      "This app's proximity zones already account for this by weighting the rear sector higher than the front — but a system reacting to a person once they're detected is not a substitute for you actively scanning before you move.",
      "Mirrors and cameras cover a meaningful share of the blind zone but rarely all of it, and never instantly — there's a real difference between a camera showing an empty space a half-second ago and the space being empty right now. That gap is exactly what a human spotter, and an agreed signal system, exists to close.",
      "The single most important habit in this lesson: if you lose sight of a person who was near the machine — on camera, in a mirror, or via a spotter — stop the movement immediately rather than assuming they're still where you last saw them.",
    ],
    standardRef: "ISO 5006 (operator field of view)",
    downloadedOffline: true,
    videoUri: "FYXOox-TDGo",
    videoSource: "Simformotion LLC — \"Cat® Simulators: Blind Spot Awareness\"",
  },
  {
    id: "proximity-alert-levels",
    title: "Amber and Red: Understanding Proximity Alerts",
    category: "safety",
    level: "foundation",
    durationMin: 4,
    languages: allLanguages,
    summary: "Learn what the alert colours mean, why the safety envelope grows in poor conditions, and why alerts require action instead of dismissal.",
    objective: "Respond consistently to amber and red proximity warnings.",
    keySteps: ["Amber: slow, scan and create space", "Red: stop dangerous motion immediately", "Check people, ground and attachment path", "Report repeated false alerts for inspection"],
    body: [
      "The proximity system in this app doesn't use fixed rings — the amber and red zone radii scale up automatically with poor visibility, rain, and wind, and widen further while swinging or reversing, per ISO 21815's collision-warning framework and ISO 16001's object-detection guidance. A zone that looks tight on a clear, calm day will be noticeably wider in fog or high wind, because the real risk is wider too.",
      "Amber means someone or something has entered the outer envelope: slow down, actively scan the area, and create separation before continuing. It's a heads-up, not yet an emergency.",
      "Red means someone is inside the zone where a collision is a live, immediate possibility, especially during swing or reverse motion. This is one of only two alerts in the whole app designed to be loud and interrupting (the other is seatbelt-while-moving) — stop the dangerous motion immediately, don't just acknowledge the alert and continue.",
      "If you believe an alert fired incorrectly — no one was actually there — don't just dismiss it and move on. A pattern of false alerts at the same spot usually means a sensor or condition issue worth reporting, not operator error to work around quietly.",
    ],
    standardRef: "ISO 16001; ISO 21815 (proximity/collision warning systems)",
    downloadedOffline: true,
    videoUri: null,
  },
  {
    id: "reversing-safely",
    title: "Reversing Safely: Blind Spot and Spotter Protocol",
    category: "safety",
    level: "foundation",
    durationMin: 5,
    languages: allLanguages,
    summary: "A repeatable reverse routine: stop, scan, sound warning, confirm the route and stop if the spotter disappears from view.",
    objective: "Reverse only when the route and people around it are controlled.",
    keySteps: ["Check route, cameras and mirrors", "Sound warning as required by site rules", "Agree signals with the spotter", "Never reverse toward an unseen person"],
    body: [
      "Reversing combines two of the highest-risk conditions on a job site at once: your worst sightlines (per ISO 5006) and the direction people are least likely to expect the machine to move. A repeatable routine matters more here than almost anywhere else in daily operation.",
      "Before reversing: stop, check the route and every mirror and camera available, and sound the warning your site procedure requires. This app's proximity envelope also widens automatically for reverse motion, per ISO 21815 — the same rear-sector weighting that applies during a swing applies here too.",
      "When a spotter is used, agree the signal system with them before starting, not partway through — a misunderstood hand signal is worse than no spotter at all, because it creates false confidence.",
      "The rule that overrides everything else: never reverse toward a person you cannot currently see, on camera, in a mirror, or via the spotter's confirmed position. If the spotter goes out of view even briefly, stop and re-establish contact before continuing.",
    ],
    standardRef: "ISO 5006; ISO 21815",
    downloadedOffline: false,
    videoUri: null,
  },
  {
    id: "ground-and-travel",
    title: "Ground, Slopes and Travel Stability",
    category: "safety",
    level: "foundation",
    durationMin: 6,
    languages: allLanguages,
    summary: "Recognise soft shoulders, trenches, buried voids, uneven ground and slopes before travelling or positioning the machine.",
    objective: "Choose a stable route and stop before a rollover risk develops.",
    keySteps: ["Inspect the route on foot where safe", "Keep loads and attachments low while travelling", "Follow machine/manual limits for slopes", "Stay clear of unsupported trench edges"],
    body: [
      "Rollover risk rarely comes from a single dramatic mistake — it usually comes from ground that looked fine and wasn't: a soft shoulder, a backfilled trench that hasn't fully compacted, a slope steeper than it appeared from the cab.",
      "This app's slope alert is grounded in ISO 3471's ROPS static stability testing methodology — the same standard behind your rollover protective structure — with the safe threshold for your machine class tightening further on wet or soft ground, or with a heavier payload. Treat that tightening as real information, not overcaution.",
      "Where it's safe to do so, inspect a new or uncertain route on foot before committing the machine to it. A visual check from the cab misses soft ground and hidden voids that are obvious underfoot.",
      "Keep the bucket, blade, or load low while travelling — it lowers your centre of gravity exactly when stability matters most, and it's a habit worth having even on ground that looks completely stable.",
      "Stay well clear of unsupported trench edges. The ground at the edge of an excavation is frequently far weaker than it looks, and a collapse under a track happens with very little warning.",
    ],
    downloadedOffline: false,
    videoUri: null,
  },
  {
    id: "utilities-and-excavation",
    title: "Excavation Near Utilities",
    category: "safety",
    level: "foundation",
    durationMin: 7,
    languages: allLanguages,
    summary: "Before digging, verify markings, exclusion zones, permit conditions and escalation steps for suspected buried services.",
    objective: "Prevent strikes to power, gas, water, fibre and other buried utilities.",
    keySteps: ["Review utility plans and markings", "Respect exclusion zones and permit conditions", "Use approved exposure methods", "Stop immediately if an unmarked service is found"],
    body: [
      "A buried utility strike can be catastrophic — a struck gas or power line is one of the few incident types on a construction site that can kill people well outside the immediate work area — and almost every one is preventable with the verification steps in this lesson.",
      "Before digging, review the utility plans and physical markings for the area, and treat any conflict between the two (markings that don't match the plan, or plans that seem outdated) as a reason to stop and verify, not a reason to guess.",
      "Respect exclusion zones and permit conditions exactly as specified, even when they seem conservative for the task at hand. They're usually conservative on purpose.",
      "Where you're working near a marked service, use the exposure method your site approves — typically hand-digging or vacuum excavation near the marked line, not bucket digging through the buffer zone.",
      "If you strike, or even suspect you've struck, an unmarked service: stop all work immediately, do not attempt to move or cover it yourself, and escalate through your site's emergency procedure. Guessing whether it's \"probably fine\" is exactly the mistake this rule exists to prevent.",
    ],
    downloadedOffline: true,
    videoUri: "zHQi1MKngRw",
    videoSource: "HAZWOPER-OSHA Training — \"Excavation and Trenching - Safe Work Practices\"",
  },
  {
    id: "monsoon-conditions",
    title: "Working Safely in Rain and Low Visibility",
    category: "safety",
    level: "foundation",
    durationMin: 5,
    languages: allLanguages,
    summary: "Rain changes traction, visibility, ground bearing capacity and stopping distance. Learn when to slow down, reduce load and pause work.",
    objective: "Adapt operation to weather instead of treating every shift as dry and clear.",
    keySteps: ["Reduce speed and increase separation", "Recheck soft ground and slopes", "Keep windows/cameras clear", "Stop work when visibility or stability is unsafe"],
    body: [
      "Weather isn't a footnote to safety on a construction site — it's one of the biggest single factors this app actively adjusts for. Proximity zones widen in rain, wind, and low visibility precisely because your stopping distance, your sightlines, and the ground's bearing capacity all get worse together, not one at a time.",
      "In wet conditions, reduce speed and increase the separation you'd normally keep from people and other machines. Traction on wet ground is far less predictable than it looks, especially on a slope you crossed safely an hour ago when it was dry.",
      "Ground that was stable in the morning can soften significantly after sustained rain — recheck slopes and soft-looking areas rather than assuming morning conditions still apply in the afternoon.",
      "Keep windows and cameras clear throughout a wet shift — a sightline that's degraded by mud or water on a lens defeats the whole point of the visibility aids you're relying on.",
      "There is no shame in stopping work when visibility or ground stability genuinely isn't safe. That call is exactly what this app's condition-adaptive zones are trying to support, not override.",
    ],
    downloadedOffline: false,
    videoUri: null,
  },
  {
    id: "communication-and-exclusion-zones",
    title: "Working Around People: Signals and Exclusion Zones",
    category: "safety",
    level: "foundation",
    durationMin: 5,
    languages: allLanguages,
    summary: "Set clear boundaries before work starts and use one agreed signal system with ground crew, truck drivers and spotters.",
    objective: "Prevent people and machines entering the same uncontrolled space.",
    keySteps: ["Confirm who is the designated spotter", "Set a visible exclusion zone", "Use clear stop signals", "Stop when communication is unclear"],
    body: [
      "Most near-misses between people and machinery don't come from someone deliberately walking into danger — they come from an unclear boundary or a signal that meant different things to two different people. This lesson is about removing that ambiguity before it matters.",
      "At the start of a task involving ground crew, confirm explicitly who the designated spotter is. \"Someone will watch for that\" is not the same as one named person having that job.",
      "Set a visible, physical exclusion zone wherever practical — cones, barriers, or a clearly marked boundary — rather than relying on people remembering an unmarked mental line.",
      "Agree on stop signals before work starts, and make sure they're unambiguous: one universally understood \"stop\" signal beats an improvised wave that could mean several things.",
      "If communication with a spotter or ground crew becomes unclear at any point — you can't confirm they saw your signal, or their signal is ambiguous — stop and re-establish clear contact before continuing. This isn't overcaution; it's exactly the assumption-check most near-misses skip.",
    ],
    downloadedOffline: false,
    videoUri: null,
  },
  {
    id: "efficient-dig-cycles",
    title: "Efficient Dig Cycles: Boom, Stick and Bucket Timing",
    category: "skill",
    level: "practice",
    durationMin: 8,
    languages: allLanguages,
    summary: "Practise the four phases of a dig cycle: dig, swing-load, dump and swing-return. Smooth control is safer and more efficient than rushing.",
    objective: "Build a repeatable, smooth cycle under trainer supervision.",
    keySteps: ["Position correctly before digging", "Avoid unnecessary swing distance", "Coordinate controls smoothly", "Finish each cycle ready for the next one"],
    body: [
      "A dig cycle breaks cleanly into four phases — dig, swing-load, dump, and swing-return — and the CAT Performance Handbook's cycle-time methodology treats smoothness through those phases, not raw speed, as the real driver of efficiency. Jerky, rushed inputs cost more time in correction than they save in speed.",
      "Good positioning before you start digging avoids the single biggest efficiency loss in this cycle: excess swing distance. Position the machine so the dig point and the dump point require the shortest reasonable swing, and that saving repeats every single cycle for the rest of the task.",
      "Coordinating boom, stick, and bucket controls smoothly and simultaneously — rather than one at a time — is what an experienced operator's cycle actually looks like, and it's exactly what this app's Ghost Operator scenario lets you practise against, alongside a replay of an expert's real cycle.",
      "Every cycle should end in a position ready for the next one, not requiring a separate repositioning move. That habit compounds across a full shift of cycles into a meaningful time difference.",
    ],
    standardRef: "CAT Performance Handbook cycle-time methodology",
    downloadedOffline: true,
    videoUri: "EqvtBa05Bp4",
    videoSource: "Messick's Equipment — \"Excavator digging technique for beginners\"",
  },
  {
    id: "loading-trucks-safely",
    title: "Loading Trucks: Position, Sequence and Communication",
    category: "skill",
    level: "practice",
    durationMin: 7,
    languages: allLanguages,
    summary: "Practise stable truck positioning, controlled bucket travel and clear coordination with drivers and ground crew.",
    objective: "Load consistently without swinging over people or creating unstable loads.",
    keySteps: ["Confirm truck position and exclusion zone", "Keep bucket movement controlled", "Load to the approved sequence", "Stop if the driver or spotter leaves the safe position"],
    body: [
      "Truck loading combines a skill task with an ongoing safety responsibility — you're coordinating with a driver, sometimes a spotter, in a space where the truck's position can change between cycles if communication slips.",
      "Confirm the truck's position and the driver's safe exclusion zone before the first cycle, and don't assume it stays fixed if the truck repositions between loads — reconfirm, don't assume.",
      "Keep the bucket's swing path controlled and predictable rather than rushed. Swinging a loaded bucket over the cab of an occupied truck, even briefly, is a real and avoidable risk many sites explicitly prohibit for exactly this reason.",
      "Load to whatever sequence your site or task specifies (front-to-back, even distribution, etc.) — an uneven or improperly sequenced load can shift dangerously in transit, which becomes someone else's hazard down the road.",
      "If the driver or a spotter leaves their confirmed safe position during loading, stop until they're back in a known, visible location. Don't continue on the assumption they'll \"probably\" step back to where they were.",
    ],
    downloadedOffline: false,
    videoUri: null,
  },
  {
    id: "idle-intent-and-fairness",
    title: "Idle Intent: Record the Real Reason",
    category: "efficiency",
    level: "beginner",
    durationMin: 4,
    languages: allLanguages,
    summary: "Learn the difference between productive standby and avoidable idle, and how to record a truck wait or site delay so it is not blamed on you.",
    objective: "Use idle tagging as evidence and improve fuel use without hiding real site problems.",
    keySteps: ["Tag truck waits and warm-up accurately", "Use the prompt only at a safe pause", "Do not tag while moving", "Raise repeated bottlenecks with the supervisor"],
    body: [
      "An hour meter can't tell the difference between you waiting on a delayed truck and you taking an unnecessary break — it just sees idle time either way. Idle Intent Tagging exists to put that context back, and it's built specifically to be your protection, not a monitor watching you.",
      "When idle time crosses a few minutes, the app asks a one-tap question: why? The framing matters — this is on the record as evidence the delay wasn't your fault, not a challenge you have to justify.",
      "Tag accurately anyway, even though a single tag is always taken at face value. The system quietly checks tags against corroborating signals like nearby-machine counts over time, and only a genuine pattern — not one mismatched tag — ever reaches a supervisor, framed as worth a conversation rather than a verdict. Honest tagging protects that trust.",
      "The prompt only appears when it's safe to answer — you'll never be asked to tap anything while the machine is moving.",
      "If you notice the same bottleneck causing idle again and again — the same truck route, the same handoff point — raise it with your supervisor directly. Individual tags protect you; a pattern raised proactively can actually fix the site problem causing them.",
    ],
    downloadedOffline: true,
    videoUri: null,
  },
  {
    id: "fuel-and-machine-care",
    title: "Fuel-Smart Operation and Machine Care",
    category: "efficiency",
    level: "foundation",
    durationMin: 5,
    languages: allLanguages,
    summary: "Smooth cycles, correct warm-up, planned pauses and early defect reporting reduce unnecessary fuel burn and avoidable wear.",
    objective: "Recognise efficient operation without sacrificing safety or output quality.",
    keySteps: ["Avoid high-RPM waiting", "Use smooth control inputs", "Report leaks and temperature warnings early", "Follow manufacturer cool-down and service guidance"],
    body: [
      "Fuel-smart operation and safe operation aren't in tension — the same smooth, controlled inputs that reduce wear and fuel burn are generally the same inputs that make a machine more predictable and safer to be around.",
      "Idling at high RPM while waiting is one of the most common avoidable fuel costs on a site. If you know a wait is coming, dropping to low idle (or off, per site procedure) costs nothing in responsiveness and saves real fuel over a shift.",
      "Smooth control inputs — the same ones covered in the dig-cycle lesson — reduce hydraulic strain and fuel burn simultaneously with reducing wear on the machine's components.",
      "Report leaks, unusual noises, and temperature warnings as soon as you notice them rather than finishing the task first. A small hydraulic leak caught early is a quick fix; the same leak ignored for a full shift can mean a much bigger repair.",
      "Follow the manufacturer's warm-up and cool-down guidance for your specific machine rather than a personal habit carried over from a different one — the correct timing varies by machine and affects both longevity and fuel efficiency.",
    ],
    downloadedOffline: false,
    videoUri: null,
  },
  {
    id: "near-miss-autopilot",
    title: "Near-Miss Autopilot: What Happens After a Close Call",
    category: "compliance",
    level: "foundation",
    durationMin: 4,
    languages: allLanguages,
    summary: "The app captures the event context for you. Learn how to confirm or correct a draft safely, and why reporting helps prevent the next incident.",
    objective: "Use near-miss reporting without added paperwork or blame.",
    keySteps: ["Let the draft capture the context", "Confirm or dismiss only when stationary", "Use voice when touch would be unsafe", "Add a short note if conditions need explaining"],
    body: [
      "A near-miss — a person in the blind spot during a swing, a hard stop right after a proximity alert, travel with the belt off — happens far more often than an actual incident, and each one is a genuinely free lesson about a risk that almost became real. Near-Miss Autopilot exists to make sure that lesson doesn't just evaporate the moment the moment passes.",
      "The moment the signature is detected, a draft incident is captured automatically, with context, before you've had to do anything. There's no paperwork burden at the moment it matters most.",
      "Confirming or dismissing that draft is deliberately gated to when the machine is stationary — this app will never ask you to tap a confirmation while you're moving or swinging. If you're still in motion when a draft appears, it waits.",
      "Voice confirmation works at any time, moving or not, precisely because it doesn't require looking at a screen or taking a hand off the controls — use it whenever tapping would mean taking your attention off the task.",
      "If the automatic capture missed some context that matters — what you were doing, what the person was doing, anything that changes how it should be read — add a short note. It's optional, but it makes the record more useful for the training replay this near-miss can become.",
    ],
    downloadedOffline: true,
    videoUri: null,
  },
  {
    id: "emergency-response",
    title: "Emergency Response: Stop, Secure, Communicate",
    category: "safety",
    level: "foundation",
    durationMin: 6,
    languages: allLanguages,
    summary: "A calm first response for alarms, contact with an obstacle, fire, rollover risk, utility strike or injury: stop work, secure the machine and follow site emergency procedure.",
    objective: "Know the first safe actions while waiting for trained emergency support.",
    keySteps: ["Stop and secure the machine", "Warn others and use the site emergency channel", "Do not improvise rescue or repairs", "Preserve the area when it is safe to do so"],
    body: [
      "This lesson isn't about becoming an emergency responder — it's about the handful of calm, correct first actions that matter most in the minute or two before trained help arrives, whatever the specific emergency turns out to be.",
      "Stop work and secure the machine first: engine off or at idle per your site's procedure, attachment lowered and stable, brake or parking mechanism engaged as appropriate. A secured machine can't add a second incident on top of the first.",
      "Warn others nearby and use your site's emergency communication channel immediately — don't wait to assess the full situation yourself before raising the alarm. Early warning gives everyone else more time to react.",
      "Do not attempt to improvise a rescue, a repair, or a fix beyond your training, however urgent it feels in the moment. Untrained intervention is a common way a single-person incident becomes a multiple-person one.",
      "Once it's safe to do so, help preserve the area rather than disturbing it — for anything involving injury, a utility strike, or significant equipment damage, the scene itself is often part of understanding what happened and preventing a repeat.",
    ],
    downloadedOffline: true,
    videoUri: null,
  },
  {
    id: "end-of-shift-handover",
    title: "End-of-Shift Log and Handover",
    category: "compliance",
    level: "beginner",
    durationMin: 4,
    languages: allLanguages,
    summary: "Review the prefilled hours, fuel, loads, task status and defect notes so the next operator starts with a reliable handover.",
    objective: "Leave a machine, task record and work area ready for the next shift.",
    keySteps: ["Park and secure according to site procedure", "Review auto-filled shift data", "Add defects and hazards clearly", "Hand over urgent issues directly"],
    body: [
      "The end-of-shift log is the other half of the paperwork this app removes rather than adds — hours, fuel used, load cycles, and task completion are already sitting in the telemetry this app has been collecting all shift, so instead of reconstructing all of that from memory at the end of a tiring day, you're reviewing and signing a report the system already assembled.",
      "Start by parking and securing the machine exactly as your site procedure specifies — this matters as much for the next operator's safety as your own end-of-shift routine.",
      "Review the auto-filled numbers rather than skimming past them. They should match your own sense of the shift; if something looks obviously wrong, that's worth flagging before you sign, not after.",
      "Add any defects or hazards clearly and specifically. \"Machine felt a bit off\" helps nobody — \"hydraulic pressure fluctuating on full extension since roughly 2pm\" gives the next operator and the maintenance team something they can actually act on.",
      "If there's anything genuinely urgent — a defect that shouldn't wait for the written log to be read, a hazard the next shift needs to know about immediately — hand it over directly and verbally as well as logging it. The written record is for continuity; a direct handover is for anything that can't wait.",
    ],
    downloadedOffline: true,
    videoUri: null,
  },
  {
    id: "ghost-operator-scoring",
    title: "Ghost Operator: How Practice Scoring Works",
    category: "skill",
    level: "practice",
    durationMin: 5,
    languages: allLanguages,
    summary: "See how cycle time, smoothness, fuel per cycle, idle time and safety decisions are compared with an expert reference trace.",
    objective: "Use simulator feedback as coaching, not a public ranking.",
    keySteps: ["Start with safety before speed", "Review one score at a time", "Repeat the scenario with one improvement goal", "Track progress against your own prior result"],
    body: [
      "The Ghost Operator scenario records an expert's real cycle — boom, stick, bucket, and swing angles over time — and replays it as a translucent guide alongside your own attempt, so you're training against a real reference rather than an abstract target.",
      "Scoring covers cycle time, smoothness, fuel per cycle, and idle time, alongside the same safety decisions this app watches for in real operation. A fast cycle that cuts a safety corner isn't actually a good score here — the scenario is built to reflect that.",
      "This data is private coaching for you specifically, per this app's design: your skill factor and session history aren't a public leaderboard, and closing the gap with the expert trace is what actually feeds back into tightening your own task-time estimates over time.",
      "Work on safety and control before raw speed. An experienced operator's cycle looks unhurried because it's smooth and well-positioned, not because it's slow — speed tends to follow naturally once the fundamentals are solid.",
      "Review one score at a time rather than trying to fix everything in a single run, and track your own progress against your own prior attempts rather than a fixed target. The goal is closing your personal gap with the expert trace, one focused rep at a time.",
    ],
    downloadedOffline: false,
    videoUri: null,
  },
];

/** A supervised new operator can follow this order in their first week. */
export const beginnerPathLessonIds = [
  "welcome-to-operatoros",
  "cab-controls-and-visibility",
  "safe-entry-exit",
  "pre-start-checklist-walkthrough",
  "seatbelt-rops-5s",
  "reading-task-cards",
  "reading-blind-spots",
  "proximity-alert-levels",
  "communication-and-exclusion-zones",
  "ground-and-travel",
  "near-miss-autopilot",
  "end-of-shift-handover",
];

export function beginnerPath(): Lesson[] {
  return beginnerPathLessonIds
    .map((id) => trainingLibrary.find((lesson) => lesson.id === id))
    .filter((lesson): lesson is Lesson => lesson !== undefined);
}

export function lessonsByCategory(category: LessonCategory): Lesson[] {
  return trainingLibrary.filter((lesson) => lesson.category === category);
}

export function downloadedLessons(): Lesson[] {
  return trainingLibrary.filter((lesson) => lesson.downloadedOffline);
}
