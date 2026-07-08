export const typeDefs = /* GraphQL */ `
  """ISO-8601 timestamp string."""
  scalar DateTime
  """Opaque cursor for connection pagination."""
  scalar Cursor
  """Arbitrary JSON payload."""
  scalar JSON

  # ────────── Common connection types ──────────
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: Cursor
    endCursor: Cursor
  }

  enum SortDirection { ASC DESC }

  # ────────── User / Profile ──────────
  type Profile {
    id: ID!
    email: String
    fullName: String
    avatarUrl: String
    headline: String
    targetRole: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type UserStats {
    applications: Int!
    resumes: Int!
    interviews: Int!
    referrals: Int!
    aiAnalyses: Int!
  }

  type Me {
    id: ID!
    email: String
    profile: Profile
    stats: UserStats!
  }

  input UpdateProfileInput {
    fullName: String
    headline: String
    targetRole: String
    avatarUrl: String
  }

  # ────────── Applications ──────────
  type Application {
    id: ID!
    company: String!
    role: String!
    location: String
    salary: String
    status: String!
    jobUrl: String
    recruiter: String
    notes: String
    deadline: DateTime
    followUpAt: DateTime
    applicationDate: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    activities(first: Int = 20): [ApplicationActivity!]!
  }
  type ApplicationEdge { cursor: Cursor! node: Application! }
  type ApplicationConnection {
    edges: [ApplicationEdge!]!
    nodes: [Application!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }
  input ApplicationFilter {
    status: String
    company: String
    search: String
    createdAfter: DateTime
    createdBefore: DateTime
  }
  enum ApplicationSortField { CREATED_AT UPDATED_AT COMPANY ROLE DEADLINE }
  input ApplicationSort { field: ApplicationSortField! = CREATED_AT direction: SortDirection! = DESC }
  input CreateApplicationInput {
    company: String!
    role: String!
    location: String
    salary: String
    status: String = "saved"
    jobUrl: String
    recruiter: String
    notes: String
    deadline: DateTime
  }
  input UpdateApplicationInput {
    company: String
    role: String
    location: String
    salary: String
    status: String
    jobUrl: String
    recruiter: String
    notes: String
    deadline: DateTime
    followUpAt: DateTime
  }
  type ApplicationActivity {
    id: ID!
    type: String!
    fromStatus: String
    toStatus: String
    message: String
    meta: JSON
    createdAt: DateTime!
  }

  # ────────── Resumes ──────────
  type Resume {
    id: ID!
    name: String!
    template: String
    tags: [String!]!
    version: Int!
    fileSize: Int
    isActive: Boolean!
    downloadCount: Int!
    lastDownloadedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    extractedText: String
  }
  type ResumeEdge { cursor: Cursor! node: Resume! }
  type ResumeConnection { edges: [ResumeEdge!]! nodes: [Resume!]! pageInfo: PageInfo! totalCount: Int! }
  input ResumeFilter { search: String tag: String activeOnly: Boolean }
  enum ResumeSortField { CREATED_AT UPDATED_AT NAME VERSION DOWNLOAD_COUNT }
  input ResumeSort { field: ResumeSortField! = CREATED_AT direction: SortDirection! = DESC }

  # ────────── AI Analyses (Resume/JobMatch/InterviewCoach/CareerCoach) ──────────
  type AiAnalysis {
    id: ID!
    kind: String!
    title: String
    input: JSON
    output: JSON
    createdAt: DateTime!
  }
  type AiAnalysisEdge { cursor: Cursor! node: AiAnalysis! }
  type AiAnalysisConnection { edges: [AiAnalysisEdge!]! nodes: [AiAnalysis!]! pageInfo: PageInfo! totalCount: Int! }
  input AiAnalysisFilter { kind: String search: String }

  # ────────── Interview Sessions (mock interviews) ──────────
  type InterviewSession {
    id: ID!
    interviewType: String
    company: String
    role: String
    difficulty: String
    mode: String
    status: String
    overallScore: Float
    confidenceScore: Float
    communicationScore: Float
    technicalScore: Float
    behavioralScore: Float
    durationSeconds: Int
    feedback: JSON
    createdAt: DateTime!
  }
  type InterviewSessionEdge { cursor: Cursor! node: InterviewSession! }
  type InterviewSessionConnection { edges: [InterviewSessionEdge!]! nodes: [InterviewSession!]! pageInfo: PageInfo! totalCount: Int! }
  input InterviewSessionFilter { interviewType: String company: String status: String }

  # ────────── Interview Notes ──────────
  type InterviewNote {
    id: ID!
    company: String
    round: String
    questions: String
    feedback: String
    mistakes: String
    learning: String
    rating: Int
    interviewDate: DateTime
    createdAt: DateTime!
  }
  type InterviewNoteEdge { cursor: Cursor! node: InterviewNote! }
  type InterviewNoteConnection { edges: [InterviewNoteEdge!]! nodes: [InterviewNote!]! pageInfo: PageInfo! totalCount: Int! }
  input CreateInterviewNoteInput {
    company: String
    round: String
    questions: String
    feedback: String
    mistakes: String
    learning: String
    rating: Int
    interviewDate: DateTime
    applicationId: ID
  }

  # ────────── Referrals ──────────
  type Referral {
    id: ID!
    referrerName: String
    company: String
    email: String
    linkedin: String
    status: String
    notes: String
    reminderDate: DateTime
    createdAt: DateTime!
  }
  type ReferralEdge { cursor: Cursor! node: Referral! }
  type ReferralConnection { edges: [ReferralEdge!]! nodes: [Referral!]! pageInfo: PageInfo! totalCount: Int! }
  input CreateReferralInput {
    referrerName: String!
    company: String
    email: String
    linkedin: String
    status: String = "pending"
    notes: String
    reminderDate: DateTime
  }

  # ────────── Analytics ──────────
  type StatusBucket { status: String! count: Int! }
  type Timepoint { date: String! count: Int! }
  type Analytics {
    totalApplications: Int!
    activeApplications: Int!
    interviewsScheduled: Int!
    offers: Int!
    rejections: Int!
    byStatus: [StatusBucket!]!
    applicationsPerWeek: [Timepoint!]!
    averageInterviewScore: Float
    resumeCount: Int!
    lastActivityAt: DateTime
  }

  # ────────── Notifications (derived from application activity) ──────────
  type Notification {
    id: ID!
    kind: String!
    title: String!
    body: String
    entityId: ID
    createdAt: DateTime!
    read: Boolean!
  }
  type NotificationConnection { nodes: [Notification!]! pageInfo: PageInfo! totalCount: Int! }

  # ────────── Root ──────────
  type Query {
    """API metadata."""
    apiInfo: JSON!

    """Currently authenticated user."""
    me: Me

    """Fetch a profile by id — subject to RLS (own profile in most projects)."""
    profile(id: ID!): Profile

    """List the current user's applications."""
    applications(
      first: Int = 20
      after: Cursor
      filter: ApplicationFilter
      sort: ApplicationSort
    ): ApplicationConnection!
    application(id: ID!): Application

    """List the current user's resumes."""
    resumes(
      first: Int = 20
      after: Cursor
      filter: ResumeFilter
      sort: ResumeSort
    ): ResumeConnection!
    resume(id: ID!): Resume

    """List AI analyses (Resume Analyzer, Job Match, Interview Coach, Career Coach, etc.)."""
    aiAnalyses(
      first: Int = 20
      after: Cursor
      filter: AiAnalysisFilter
    ): AiAnalysisConnection!

    """Convenience shortcuts scoped to a single AI kind."""
    resumeAnalyses(first: Int = 20, after: Cursor): AiAnalysisConnection!
    jobMatches(first: Int = 20, after: Cursor): AiAnalysisConnection!
    interviewCoachSessions(first: Int = 20, after: Cursor): AiAnalysisConnection!
    careerCoachPlans(first: Int = 20, after: Cursor): AiAnalysisConnection!

    """Mock interview sessions."""
    interviewSessions(
      first: Int = 20
      after: Cursor
      filter: InterviewSessionFilter
    ): InterviewSessionConnection!

    """Written interview retrospectives."""
    interviewNotes(first: Int = 20, after: Cursor): InterviewNoteConnection!

    """Referral pipeline."""
    referrals(first: Int = 20, after: Cursor): ReferralConnection!

    """Aggregated analytics for the current user."""
    analytics: Analytics!

    """Recent activity surfaced as notifications."""
    notifications(first: Int = 20, after: Cursor): NotificationConnection!
  }

  type Mutation {
    updateProfile(input: UpdateProfileInput!): Profile!

    createApplication(input: CreateApplicationInput!): Application!
    updateApplication(id: ID!, input: UpdateApplicationInput!): Application!
    deleteApplication(id: ID!): Boolean!

    createReferral(input: CreateReferralInput!): Referral!
    deleteReferral(id: ID!): Boolean!

    createInterviewNote(input: CreateInterviewNoteInput!): InterviewNote!
    deleteInterviewNote(id: ID!): Boolean!

    """Delete an AI analysis (resume analysis, job match, etc.)."""
    deleteAiAnalysis(id: ID!): Boolean!
  }
`;
