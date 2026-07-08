// Shared schema shapes and empty defaults for the AI feature set.
// Extracted from the original ai.functions.ts and kept in one place so each
// service file (resume, cover-letter, job-match, interview, career) can import
// only what it needs.

// ----- Resume Analyzer -----
export const sectionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "findings", "recommendations"],
  properties: {
    score: { type: "number" },
    findings: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
  },
} as const;

export const resumeAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "ats_score", "ats_explanation", "summary", "strengths",
    "missing_skills", "keyword_match", "keyword_heatmap",
    "grammar_issues", "formatting_issues", "improvements",
    "sections", "skill_gaps", "readability",
    "experience_analysis", "project_analysis", "education_analysis", "achievements_analysis",
    "improvement_checklist",
  ],
  properties: {
    ats_score: { type: "number" },
    ats_explanation: { type: "string" },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    missing_skills: { type: "array", items: { type: "string" } },
    keyword_match: { type: "array", items: { type: "string" } },
    keyword_heatmap: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["keyword", "count", "importance", "present"],
        properties: {
          keyword: { type: "string" },
          count: { type: "number" },
          importance: { type: "string", enum: ["high", "medium", "low"] },
          present: { type: "boolean" },
        },
      },
    },
    grammar_issues: { type: "array", items: { type: "string" } },
    formatting_issues: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    sections: {
      type: "object",
      additionalProperties: false,
      required: ["contact", "summary", "experience", "education", "skills", "projects", "achievements"],
      properties: {
        contact: sectionSchema,
        summary: sectionSchema,
        experience: sectionSchema,
        education: sectionSchema,
        skills: sectionSchema,
        projects: sectionSchema,
        achievements: sectionSchema,
      },
    },
    skill_gaps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["skill", "importance", "why"],
        properties: {
          skill: { type: "string" },
          importance: { type: "string", enum: ["high", "medium", "low"] },
          why: { type: "string" },
        },
      },
    },
    readability: {
      type: "object",
      additionalProperties: false,
      required: ["score", "grade_level", "notes"],
      properties: {
        score: { type: "number" },
        grade_level: { type: "string" },
        notes: { type: "array", items: { type: "string" } },
      },
    },
    experience_analysis: {
      type: "object",
      additionalProperties: false,
      required: ["impact_score", "quantified_bullets", "total_bullets", "findings", "recommendations"],
      properties: {
        impact_score: { type: "number" },
        quantified_bullets: { type: "number" },
        total_bullets: { type: "number" },
        findings: { type: "array", items: { type: "string" } },
        recommendations: { type: "array", items: { type: "string" } },
      },
    },
    project_analysis: {
      type: "object",
      additionalProperties: false,
      required: ["count", "findings", "recommendations"],
      properties: {
        count: { type: "number" },
        findings: { type: "array", items: { type: "string" } },
        recommendations: { type: "array", items: { type: "string" } },
      },
    },
    education_analysis: {
      type: "object",
      additionalProperties: false,
      required: ["findings", "recommendations"],
      properties: {
        findings: { type: "array", items: { type: "string" } },
        recommendations: { type: "array", items: { type: "string" } },
      },
    },
    achievements_analysis: {
      type: "object",
      additionalProperties: false,
      required: ["quantified", "findings", "recommendations"],
      properties: {
        quantified: { type: "array", items: { type: "string" } },
        findings: { type: "array", items: { type: "string" } },
        recommendations: { type: "array", items: { type: "string" } },
      },
    },
    improvement_checklist: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "priority", "category"],
        properties: {
          item: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          category: { type: "string" },
        },
      },
    },
  },
} as const;

export const resumeCompareSchema = {
  type: "object",
  additionalProperties: false,
  required: ["winner", "verdict", "score_a", "score_b", "improvements_a_to_b", "regressions_a_to_b", "keyword_delta", "recommendations"],
  properties: {
    winner: { type: "string", enum: ["a", "b", "tie"] },
    verdict: { type: "string" },
    score_a: { type: "number" },
    score_b: { type: "number" },
    improvements_a_to_b: { type: "array", items: { type: "string" } },
    regressions_a_to_b: { type: "array", items: { type: "string" } },
    keyword_delta: {
      type: "object",
      additionalProperties: false,
      required: ["added", "removed"],
      properties: {
        added: { type: "array", items: { type: "string" } },
        removed: { type: "array", items: { type: "string" } },
      },
    },
    recommendations: { type: "array", items: { type: "string" } },
  },
} as const;

// ----- Job Match -----
export const jobMatchSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "match_percentage", "verdict",
    "skills_match", "technology_match",
    "missing_skills", "missing_technologies", "missing_soft_skills",
    "strengths", "weaknesses", "improvements",
    "salary_estimate", "interview_probability",
    "learning_roadmap", "recommended_certifications", "recommended_projects",
  ],
  properties: {
    match_percentage: { type: "number" },
    verdict: { type: "string" },
    skills_match: {
      type: "object",
      additionalProperties: false,
      required: ["score", "matched", "partial"],
      properties: {
        score: { type: "number" },
        matched: { type: "array", items: { type: "string" } },
        partial: { type: "array", items: { type: "string" } },
      },
    },
    technology_match: {
      type: "object",
      additionalProperties: false,
      required: ["score", "matched", "partial"],
      properties: {
        score: { type: "number" },
        matched: { type: "array", items: { type: "string" } },
        partial: { type: "array", items: { type: "string" } },
      },
    },
    missing_skills: { type: "array", items: { type: "string" } },
    missing_technologies: { type: "array", items: { type: "string" } },
    missing_soft_skills: { type: "array", items: { type: "string" } },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    salary_estimate: {
      type: "object",
      additionalProperties: false,
      required: ["currency", "min", "median", "max", "region", "notes"],
      properties: {
        currency: { type: "string" },
        min: { type: "number" },
        median: { type: "number" },
        max: { type: "number" },
        region: { type: "string" },
        notes: { type: "string" },
      },
    },
    interview_probability: {
      type: "object",
      additionalProperties: false,
      required: ["score", "reasoning"],
      properties: {
        score: { type: "number" },
        reasoning: { type: "string" },
      },
    },
    learning_roadmap: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["week", "focus", "resources", "outcome"],
        properties: {
          week: { type: "string" },
          focus: { type: "string" },
          resources: { type: "array", items: { type: "string" } },
          outcome: { type: "string" },
        },
      },
    },
    recommended_certifications: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "provider", "why"],
        properties: {
          name: { type: "string" },
          provider: { type: "string" },
          why: { type: "string" },
        },
      },
    },
    recommended_projects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "skills"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          skills: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

// ----- Interview Prep -----
const interviewQuestionShape = {
  type: "object",
  additionalProperties: false,
  required: ["question", "difficulty", "why_asked", "star_hint"],
  properties: {
    question: { type: "string" },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
    why_asked: { type: "string" },
    star_hint: { type: "string" },
  },
} as const;

const codingQuestionShape = {
  type: "object",
  additionalProperties: false,
  required: ["title", "prompt", "difficulty", "topics", "approach", "complexity"],
  properties: {
    title: { type: "string" },
    prompt: { type: "string" },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
    topics: { type: "array", items: { type: "string" } },
    approach: { type: "string" },
    complexity: { type: "string" },
  },
} as const;

export const interviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["company_research", "culture_notes", "recent_news", "behavioral", "technical", "coding", "hr", "coding_tips", "red_flags", "questions_to_ask"],
  properties: {
    company_research: { type: "string" },
    culture_notes: { type: "array", items: { type: "string" } },
    recent_news: { type: "array", items: { type: "string" } },
    behavioral: { type: "array", items: interviewQuestionShape },
    technical: { type: "array", items: interviewQuestionShape },
    coding: { type: "array", items: codingQuestionShape },
    hr: { type: "array", items: interviewQuestionShape },
    coding_tips: { type: "array", items: { type: "string" } },
    red_flags: { type: "array", items: { type: "string" } },
    questions_to_ask: { type: "array", items: { type: "string" } },
  },
} as const;

export const starSchema = {
  type: "object",
  additionalProperties: false,
  required: ["situation", "task", "action", "result", "polished_answer", "tips"],
  properties: {
    situation: { type: "string" },
    task: { type: "string" },
    action: { type: "string" },
    result: { type: "string" },
    polished_answer: { type: "string" },
    tips: { type: "array", items: { type: "string" } },
  },
} as const;

export const scoreSchema = {
  type: "object",
  additionalProperties: false,
  required: ["overall_score", "clarity", "structure", "relevance", "impact", "confidence", "strengths", "weaknesses", "improvements", "model_answer", "verdict"],
  properties: {
    overall_score: { type: "number" },
    clarity: { type: "number" },
    structure: { type: "number" },
    relevance: { type: "number" },
    impact: { type: "number" },
    confidence: { type: "number" },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    model_answer: { type: "string" },
    verdict: { type: "string" },
  },
} as const;

// ----- Career Coach -----
const roadmapWeekShape = {
  type: "object",
  additionalProperties: false,
  required: ["day", "focus", "tasks", "hours", "outcome"],
  properties: {
    day: { type: "string" },
    focus: { type: "string" },
    tasks: { type: "array", items: { type: "string" } },
    hours: { type: "number" },
    outcome: { type: "string" },
  },
} as const;

const roadmapMonthShape = {
  type: "object",
  additionalProperties: false,
  required: ["week", "theme", "milestones", "deliverables"],
  properties: {
    week: { type: "string" },
    theme: { type: "string" },
    milestones: { type: "array", items: { type: "string" } },
    deliverables: { type: "array", items: { type: "string" } },
  },
} as const;

const skillRecShape = {
  type: "object",
  additionalProperties: false,
  required: ["name", "category", "priority", "current_level", "target_level", "why"],
  properties: {
    name: { type: "string" },
    category: { type: "string" },
    priority: { type: "string", enum: ["high", "medium", "low"] },
    current_level: { type: "number" },
    target_level: { type: "number" },
    why: { type: "string" },
  },
} as const;

const goalRecShape = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "category", "priority", "timeframe_weeks"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    category: { type: "string" },
    priority: { type: "string", enum: ["high", "medium", "low"] },
    timeframe_weeks: { type: "number" },
  },
} as const;

const learningRecShape = {
  type: "object",
  additionalProperties: false,
  required: ["title", "provider", "type", "url_hint", "duration", "why"],
  properties: {
    title: { type: "string" },
    provider: { type: "string" },
    type: { type: "string", enum: ["course", "book", "video", "docs", "bootcamp", "article"] },
    url_hint: { type: "string" },
    duration: { type: "string" },
    why: { type: "string" },
  },
} as const;

const internshipRecShape = {
  type: "object",
  additionalProperties: false,
  required: ["company", "role", "type", "why", "how_to_apply"],
  properties: {
    company: { type: "string" },
    role: { type: "string" },
    type: { type: "string" },
    why: { type: "string" },
    how_to_apply: { type: "string" },
  },
} as const;

const companyRecShape = {
  type: "object",
  additionalProperties: false,
  required: ["name", "why", "tier", "roles"],
  properties: {
    name: { type: "string" },
    why: { type: "string" },
    tier: { type: "string", enum: ["reach", "target", "safety"] },
    roles: { type: "array", items: { type: "string" } },
  },
} as const;

const techRecShape = {
  type: "object",
  additionalProperties: false,
  required: ["name", "category", "priority", "why"],
  properties: {
    name: { type: "string" },
    category: { type: "string" },
    priority: { type: "string", enum: ["high", "medium", "low"] },
    why: { type: "string" },
  },
} as const;

const certRecShape = {
  type: "object",
  additionalProperties: false,
  required: ["name", "provider", "difficulty", "cost_estimate", "duration", "why"],
  properties: {
    name: { type: "string" },
    provider: { type: "string" },
    difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    cost_estimate: { type: "string" },
    duration: { type: "string" },
    why: { type: "string" },
  },
} as const;

export const careerSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "insights", "weekly_roadmap", "monthly_roadmap",
    "skill_recommendations", "goal_recommendations",
    "learning_recommendations", "internship_recommendations",
    "company_recommendations", "technology_recommendations", "certification_recommendations",
  ],
  properties: {
    insights: { type: "string" },
    weekly_roadmap: { type: "array", items: roadmapWeekShape },
    monthly_roadmap: { type: "array", items: roadmapMonthShape },
    skill_recommendations: { type: "array", items: skillRecShape },
    goal_recommendations: { type: "array", items: goalRecShape },
    learning_recommendations: { type: "array", items: learningRecShape },
    internship_recommendations: { type: "array", items: internshipRecShape },
    company_recommendations: { type: "array", items: companyRecShape },
    technology_recommendations: { type: "array", items: techRecShape },
    certification_recommendations: { type: "array", items: certRecShape },
  },
} as const;
