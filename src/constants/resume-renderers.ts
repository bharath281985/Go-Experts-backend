export interface ResumeRendererCapability {
  rendererKey: string;
  rendererVersion: number;
  name: string;
  supportedSections: string[];
  supportedThemeOptions: string[];
}

export const RESUME_RENDERERS: Record<string, ResumeRendererCapability> = {
  professional: {
    rendererKey: "professional",
    rendererVersion: 1,
    name: "Professional",
    supportedSections: [
      "profile",
      "headline",
      "summary",
      "experience",
      "education",
      "skills",
      "projects",
      "certifications",
      "languages",
      "portfolioLinks",
      "socialLinks"
    ],
    supportedThemeOptions: ["accentColor", "fontFamily", "density"]
  },
  modern: {
    rendererKey: "modern",
    rendererVersion: 1,
    name: "Modern",
    supportedSections: [
      "profile",
      "headline",
      "summary",
      "experience",
      "education",
      "skills",
      "projects",
      "certifications",
      "languages",
      "awards",
      "portfolioLinks",
      "socialLinks"
    ],
    supportedThemeOptions: ["accentColor", "fontFamily", "density", "showIcons"]
  },
  ats: {
    rendererKey: "ats",
    rendererVersion: 1,
    name: "ATS Optimized",
    supportedSections: [
      "profile",
      "headline",
      "summary",
      "experience",
      "education",
      "skills",
      "projects",
      "certifications",
      "languages"
    ],
    supportedThemeOptions: ["fontFamily"]
  },
  creative: {
    rendererKey: "creative",
    rendererVersion: 1,
    name: "Creative",
    supportedSections: [
      "profile",
      "headline",
      "summary",
      "experience",
      "education",
      "skills",
      "projects",
      "certifications",
      "languages",
      "awards",
      "references",
      "portfolioLinks",
      "socialLinks"
    ],
    supportedThemeOptions: ["accentColor", "fontFamily", "layoutStyle"]
  },
  developer: {
    rendererKey: "developer",
    rendererVersion: 1,
    name: "Developer",
    supportedSections: [
      "profile",
      "headline",
      "summary",
      "experience",
      "education",
      "skills",
      "projects",
      "certifications",
      "portfolioLinks",
      "socialLinks",
      "githubStats"
    ],
    supportedThemeOptions: ["accentColor", "fontFamily", "themeMode"]
  }
};

export const VALID_RENDERER_KEYS = Object.keys(RESUME_RENDERERS);
