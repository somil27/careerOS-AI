// Shared types + empty defaults for the AI feature set.
export const emptyResumeAnalysis = {
  ats_score: 0,
  ats_explanation: "",
  summary: "",
  strengths: [] as string[],
  missing_skills: [] as string[],
  keyword_match: [] as string[],
  keyword_heatmap: [] as Array<{ keyword: string; count: number; importance: "high" | "medium" | "low"; present: boolean }>,
  grammar_issues: [] as string[],
  formatting_issues: [] as string[],
  improvements: [] as string[],
  sections: {
    contact: { score: 0, findings: [], recommendations: [] },
    summary: { score: 0, findings: [], recommendations: [] },
    experience: { score: 0, findings: [], recommendations: [] },
    education: { score: 0, findings: [], recommendations: [] },
    skills: { score: 0, findings: [], recommendations: [] },
    projects: { score: 0, findings: [], recommendations: [] },
    achievements: { score: 0, findings: [], recommendations: [] },
  },
  skill_gaps: [] as Array<{ skill: string; importance: "high" | "medium" | "low"; why: string }>,
  readability: { score: 0, grade_level: "", notes: [] as string[] },
  experience_analysis: { impact_score: 0, quantified_bullets: 0, total_bullets: 0, findings: [] as string[], recommendations: [] as string[] },
  project_analysis: { count: 0, findings: [] as string[], recommendations: [] as string[] },
  education_analysis: { findings: [] as string[], recommendations: [] as string[] },
  achievements_analysis: { quantified: [] as string[], findings: [] as string[], recommendations: [] as string[] },
  improvement_checklist: [] as Array<{ item: string; priority: "high" | "medium" | "low"; category: string }>,
};
export type ResumeAnalysis = typeof emptyResumeAnalysis;

export const emptyJobMatch = {
  match_percentage: 0,
  verdict: "",
  skills_match: { score: 0, matched: [] as string[], partial: [] as string[] },
  technology_match: { score: 0, matched: [] as string[], partial: [] as string[] },
  missing_skills: [] as string[],
  missing_technologies: [] as string[],
  missing_soft_skills: [] as string[],
  strengths: [] as string[],
  weaknesses: [] as string[],
  improvements: [] as string[],
  salary_estimate: { currency: "USD", min: 0, median: 0, max: 0, region: "", notes: "" },
  interview_probability: { score: 0, reasoning: "" },
  learning_roadmap: [] as Array<{ week: string; focus: string; resources: string[]; outcome: string }>,
  recommended_certifications: [] as Array<{ name: string; provider: string; why: string }>,
  recommended_projects: [] as Array<{ title: string; description: string; skills: string[] }>,
};
export type JobMatchResult = typeof emptyJobMatch;

export const emptyInterviewPrep = {
  company_research: "",
  culture_notes: [] as string[],
  recent_news: [] as string[],
  behavioral: [] as Array<{ question: string; difficulty: "easy" | "medium" | "hard"; why_asked: string; star_hint: string }>,
  technical: [] as Array<{ question: string; difficulty: "easy" | "medium" | "hard"; why_asked: string; star_hint: string }>,
  coding: [] as Array<{ title: string; prompt: string; difficulty: "easy" | "medium" | "hard"; topics: string[]; approach: string; complexity: string }>,
  hr: [] as Array<{ question: string; difficulty: "easy" | "medium" | "hard"; why_asked: string; star_hint: string }>,
  coding_tips: [] as string[],
  red_flags: [] as string[],
  questions_to_ask: [] as string[],
};
export type InterviewPrep = typeof emptyInterviewPrep;

export const emptyCareerPlan = {
  insights: "",
  weekly_roadmap: [] as Array<{ day: string; focus: string; tasks: string[]; hours: number; outcome: string }>,
  monthly_roadmap: [] as Array<{ week: string; theme: string; milestones: string[]; deliverables: string[] }>,
  skill_recommendations: [] as Array<{ name: string; category: string; priority: "high" | "medium" | "low"; current_level: number; target_level: number; why: string }>,
  goal_recommendations: [] as Array<{ title: string; description: string; category: string; priority: "high" | "medium" | "low"; timeframe_weeks: number }>,
  learning_recommendations: [] as Array<{ title: string; provider: string; type: string; url_hint: string; duration: string; why: string }>,
  internship_recommendations: [] as Array<{ company: string; role: string; type: string; why: string; how_to_apply: string }>,
  company_recommendations: [] as Array<{ name: string; why: string; tier: "reach" | "target" | "safety"; roles: string[] }>,
  technology_recommendations: [] as Array<{ name: string; category: string; priority: "high" | "medium" | "low"; why: string }>,
  certification_recommendations: [] as Array<{ name: string; provider: string; difficulty: string; cost_estimate: string; duration: string; why: string }>,
};
export type CareerPlan = typeof emptyCareerPlan;
