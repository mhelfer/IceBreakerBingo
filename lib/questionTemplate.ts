// Built-in starter question set the facilitator forks per event.
// Each entry produces one survey_questions row and zero or more
// trait_templates rows. For single/multi/binary/numeric questions, a cohort
// template is emitted per option. For text questions, one discovery template.

import type { QuestionType } from "./traits";

export type StarterQuestion = {
  prompt: string;
  type: QuestionType;
  options?: string[];
  // For cohort types: called per option at fork time.
  cohort_square_text?: (option: string) => string;
  cohort_prompt?: (option: string) => string;
  // For text types.
  discovery_square_text?: string;
};

export const STARTER_QUESTIONS: StarterQuestion[] = [
  {
    prompt: "Where did you grow up?",
    type: "text",
    discovery_square_text: "Learn where someone grew up",
  },
  {
    prompt: "What was your first programming language?",
    type: "single",
    options: ["Python", "JavaScript", "Java", "C / C++", "Go", "Rust", "Other"],
    cohort_square_text: (o) => `First language: ${o}`.slice(0, 36),
    cohort_prompt: (o) => `Ask what they first built in ${o}.`,
  },
  {
    prompt: "Any pets?",
    type: "multi",
    options: ["Dog", "Cat", "Fish", "Bird", "Reptile", "None"],
    cohort_square_text: (o) => `Has a ${o.toLowerCase()}`.slice(0, 36),
    cohort_prompt: (o) => `Ask about their ${o.toLowerCase()}.`,
  },
  {
    prompt: "Tabs or spaces?",
    type: "binary",
    options: ["Tabs", "Spaces"],
    cohort_square_text: (o) => `Team ${o.toLowerCase()}`,
    cohort_prompt: (o) => `Get their ${o.toLowerCase()} origin story.`,
  },
  {
    prompt: "What's your non-tech hobby?",
    type: "text",
    discovery_square_text: "Learn someone's hobby",
  },
  {
    prompt: "What's a weird or unexpected skill you have?",
    type: "text",
    discovery_square_text: "Learn someone's hidden talent",
  },
  {
    prompt: "Years coding?",
    type: "numeric_bucket",
    options: ["0–2", "3–5", "5–10", "10+"],
    cohort_square_text: (o) => `${o} years coding`,
    cohort_prompt: (o) => `Compare notes on ${o} years in the trade.`,
  },
  {
    prompt: "Daily-driver OS?",
    type: "single",
    options: ["macOS", "Linux", "Windows", "ChromeOS / other"],
    cohort_square_text: (o) => `Runs ${o}`.slice(0, 36),
    cohort_prompt: (o) => `Ask what pulled them to ${o}.`,
  },
  {
    prompt: "Morning person or night owl?",
    type: "binary",
    options: ["Morning", "Night owl"],
    cohort_square_text: (o) =>
      o === "Morning" ? "Morning person" : "Night owl",
    cohort_prompt: (o) =>
      o === "Morning"
        ? "Ask when they're most productive."
        : "Ask about late-night coding sessions.",
  },
  {
    prompt: "What's your favorite debugging snack?",
    type: "text",
    discovery_square_text: "Learn someone's debug snack",
  },
  {
    prompt: "Mountains or ocean?",
    type: "binary",
    options: ["Mountains", "Ocean"],
    cohort_square_text: (o) => `Team ${o.toLowerCase()}`,
    cohort_prompt: (o) => `Ask about their favorite ${o.toLowerCase()} spot.`,
  },
  {
    prompt: "Dream side project?",
    type: "text",
    discovery_square_text: "Learn someone's dream project",
  },
  {
    prompt: "What's a conference you've been to?",
    type: "text",
    discovery_square_text: "Learn a conference someone attended",
  },
  {
    prompt: "Hot take: Vim or Emacs?",
    type: "binary",
    options: ["Vim", "Emacs"],
    cohort_square_text: (o) => `${o} partisan`,
    cohort_prompt: (o) => `Ask why ${o} won them over.`,
  },
];
