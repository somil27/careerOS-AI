// Barrel re-exports for the AI feature set.
// Backwards-compatible with the previous single-file module: existing imports
// from `@/features/ai/ai.functions` continue to work while the implementation
// lives in per-domain service files.
export { analyzeResume, compareResumes } from "./resume.service";
export { generateCoverLetter } from "./cover-letter.service";
export { matchJob } from "./job-match.service";
export { interviewPrep, generateStarAnswer, scoreInterviewAnswer } from "./interview.service";
export { careerCoach } from "./career.service";
export type { ResumeAnalysis, JobMatchResult, InterviewPrep, CareerPlan } from "./types";
