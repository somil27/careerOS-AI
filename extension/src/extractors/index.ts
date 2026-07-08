import type { JobPayload } from "../types";

const clean = (s: string | null | undefined) => (s ? s.replace(/\s+/g, " ").trim() : null);

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").replace(/\s+\n/g, "\n").trim();
}

function textFrom(sel: string, root: ParentNode = document): string | null {
  const el = root.querySelector(sel);
  return el ? clean(el.textContent) : null;
}

// Extract common JobPosting JSON-LD blocks and normalize.
function extractJsonLd(): Partial<JobPayload> {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  for (const s of scripts) {
    try {
      const raw = JSON.parse(s.textContent || "null");
      const items = Array.isArray(raw) ? raw : raw?.["@graph"] || [raw];
      for (const item of items) {
        const t = item?.["@type"];
        const isJob = Array.isArray(t) ? t.includes("JobPosting") : t === "JobPosting";
        if (!isJob) continue;
        const salary =
          item.baseSalary?.value?.value ??
          item.baseSalary?.value?.minValue ??
          item.estimatedSalary?.[0]?.value?.value ??
          null;
        const salaryCurrency = item.baseSalary?.currency ?? item.baseSalary?.value?.currency ?? "";
        const salaryUnit = item.baseSalary?.value?.unitText ?? "";
        const loc =
          item.jobLocation?.address?.addressLocality ??
          item.jobLocation?.[0]?.address?.addressLocality ??
          item.jobLocation?.address?.addressRegion ??
          (item.jobLocationType === "TELECOMMUTE" ? "Remote" : null);
        return {
          role: clean(item.title),
          company: clean(item.hiringOrganization?.name),
          location: clean(typeof loc === "string" ? loc : null),
          salary: salary ? clean(`${salaryCurrency} ${salary} ${salaryUnit}`.trim()) : null,
          description: item.description ? stripHtml(String(item.description)).slice(0, 20000) : null,
          deadline: item.validThrough ? String(item.validThrough).slice(0, 10) : null,
          skills: typeof item.skills === "string" ? item.skills.split(/[,;]\s*/).filter(Boolean) : [],
        };
      }
    } catch {
      /* ignore */
    }
  }
  return {};
}

const SKILL_HINTS = [
  "javascript", "typescript", "react", "next.js", "node", "node.js", "python", "django", "flask",
  "java", "spring", "kotlin", "swift", "go", "rust", "c++", "c#", ".net", "ruby", "rails", "php",
  "laravel", "sql", "postgresql", "mysql", "mongodb", "redis", "kafka", "aws", "gcp", "azure",
  "docker", "kubernetes", "terraform", "graphql", "rest", "figma", "product management", "agile",
  "scrum", "machine learning", "pytorch", "tensorflow", "nlp", "llm", "excel", "tableau", "power bi",
];

function inferSkills(text: string, seed: string[] = []): string[] {
  const found = new Set(seed.map((x) => x.toLowerCase()));
  const t = text.toLowerCase();
  for (const s of SKILL_HINTS) if (t.includes(s)) found.add(s);
  return Array.from(found).slice(0, 20);
}

function detectSource(host: string): string {
  if (host.includes("linkedin")) return "linkedin";
  if (host.includes("wellfound")) return "wellfound";
  if (host.includes("internshala")) return "internshala";
  if (host.includes("naukri")) return "naukri";
  if (host.includes("indeed")) return "indeed";
  if (host.includes("glassdoor")) return "glassdoor";
  if (host.includes("greenhouse")) return "greenhouse";
  if (host.includes("lever")) return "lever";
  if (host.includes("ashby")) return "ashby";
  return "web";
}

// --- Site-specific fallbacks used when JSON-LD is missing / partial ---
function siteFallback(host: string): Partial<JobPayload> {
  if (host.includes("linkedin")) {
    return {
      role: textFrom(".job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1"),
      company: textFrom(".job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name, .topcard__org-name-link"),
      location: textFrom(".job-details-jobs-unified-top-card__primary-description-container span, .jobs-unified-top-card__bullet"),
      description: clean(textFrom("#job-details, .jobs-description__content, .show-more-less-html__markup")),
    };
  }
  if (host.includes("wellfound")) {
    return {
      role: textFrom('h1, [class*="styles_title"]'),
      company: textFrom('a[href*="/company/"], [class*="styles_component"] h2'),
      location: textFrom('[class*="location"]'),
      description: clean(textFrom('[class*="description"], .job-description')),
    };
  }
  if (host.includes("internshala")) {
    return {
      role: textFrom(".profile_on_detail_page, .heading_4_5, h1"),
      company: textFrom(".company_name, .link_display_like_text"),
      location: textFrom("#location_names, .location_link"),
      salary: textFrom(".stipend, .stipend_container_shine"),
      deadline: textFrom(".other_detail_item_row .item_body"),
      description: clean(textFrom(".internship_details, .about_company, .text-container")),
    };
  }
  if (host.includes("naukri")) {
    return {
      role: textFrom(".styles_jd-header-title__rZwM1, h1"),
      company: textFrom(".styles_jd-header-comp-name__MvqAI a, .jd-header-comp-name a"),
      location: textFrom(".styles_jhc__loc___Du2H, .location"),
      salary: textFrom(".styles_jhc__salary__jdfEC, .salary"),
      description: clean(textFrom(".styles_JDC__dang-inner-html__h0K4t, .job-desc, .dang-inner-html")),
    };
  }
  if (host.includes("indeed")) {
    return {
      role: textFrom('h1[data-testid="jobsearch-JobInfoHeader-title"], h1.jobsearch-JobInfoHeader-title'),
      company: textFrom('[data-testid="inlineHeader-companyName"] a, [data-company-name="true"]'),
      location: textFrom('[data-testid="inlineHeader-companyLocation"], [data-testid="jobsearch-JobInfoHeader-companyLocation"]'),
      salary: textFrom('[id*="salaryInfoAndJobType"] span, [data-testid="attribute_snippet_testid"]'),
      description: clean(textFrom("#jobDescriptionText")),
    };
  }
  if (host.includes("glassdoor")) {
    return {
      role: textFrom('[data-test="job-title"], h1'),
      company: textFrom('[data-test="employer-name"], [class*="EmployerProfile_employerName"]'),
      location: textFrom('[data-test="location"]'),
      salary: textFrom('[data-test="detailSalary"]'),
      description: clean(textFrom('[class*="JobDetails_jobDescription"], .jobDescriptionContent')),
    };
  }
  if (host.includes("greenhouse")) {
    return {
      role: textFrom("h1.app-title, h1"),
      company: textFrom(".company-name, .app-company"),
      location: textFrom(".location, .app-location"),
      description: clean(textFrom("#content, #app_body, .app-body")),
    };
  }
  if (host.includes("lever")) {
    return {
      role: textFrom(".posting-headline h2, h2"),
      company: textFrom(".main-header-logo img") ? document.title.split("-")[0].trim() : textFrom(".main-header .company-name"),
      location: textFrom(".posting-categories .location, .sort-by-time"),
      description: clean(textFrom(".content .section-wrapper, .posting-page .content, .section-wrapper.page-full-width")),
    };
  }
  if (host.includes("ashby")) {
    return {
      role: textFrom("h1"),
      company: textFrom('[class*="_companyName"], header a'),
      location: textFrom('[class*="_locationList"], [class*="location"]'),
      description: clean(textFrom('[class*="_descriptionText"], [class*="job-description"], main')),
    };
  }
  return {};
}

export function extractJob(): JobPayload {
  const host = location.hostname;
  const source = detectSource(host);
  const jsonLd = extractJsonLd();
  const fallback = siteFallback(host);

  const merged: JobPayload = {
    source,
    apply_url: location.href.split("#")[0],
    company: jsonLd.company ?? fallback.company ?? null,
    role: jsonLd.role ?? fallback.role ?? null,
    location: jsonLd.location ?? fallback.location ?? null,
    salary: jsonLd.salary ?? fallback.salary ?? null,
    description: jsonLd.description ?? fallback.description ?? null,
    recruiter: fallback.recruiter ?? null,
    deadline: jsonLd.deadline ?? fallback.deadline ?? null,
    skills: [],
  };

  merged.skills = inferSkills(`${merged.role ?? ""}\n${merged.description ?? ""}`, jsonLd.skills ?? []);
  return merged;
}
