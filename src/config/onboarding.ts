export const ONBOARDING_CONFIG: Record<string, { totalSteps: number; steps: { key: string; label: string; weight: number }[] }> = {
  freelancer: {
    totalSteps: 4,
    steps: [
      { key: "account", label: "Account", weight: 20 },
      { key: "profile", label: "Profile", weight: 30 },
      { key: "skills", label: "Skills & Category", weight: 30 },
      { key: "experience", label: "Experience & Links", weight: 20 },
    ]
  },
  client: {
    totalSteps: 4,
    steps: [
      { key: "account", label: "Account", weight: 20 },
      { key: "business_details", label: "Business Details", weight: 30 },
      { key: "profile_role", label: "Profile & Role", weight: 30 },
      { key: "team_budget", label: "Team & Budget", weight: 20 },
    ]
  },
  founder: {
    totalSteps: 4,
    steps: [
      { key: "account", label: "Account", weight: 20 },
      { key: "startup_details", label: "Startup Details", weight: 30 },
      { key: "profile_role", label: "Profile & Role", weight: 30 },
      { key: "startup_goals", label: "Startup Goals", weight: 20 },
    ]
  },
  investor: {
    totalSteps: 3,
    steps: [
      { key: "account", label: "Account", weight: 30 },
      { key: "investor_profile", label: "Investor Profile", weight: 40 },
      { key: "investment_preferences", label: "Investment Preferences", weight: 30 },
    ]
  }
};

export const calculateOnboardingProgress = (role: string, currentStepIndex: number, completed: boolean = false) => {
  const config = ONBOARDING_CONFIG[role.toLowerCase()] || ONBOARDING_CONFIG.freelancer;
  
  if (completed || currentStepIndex >= config.totalSteps) {
    return {
      status: "COMPLETED",
      completedSteps: config.steps.map(s => s.key),
      currentStep: null,
      nextStepKey: null,
      percentage: 100
    };
  }
  
  const completedSteps = config.steps.slice(0, currentStepIndex).map(s => s.key);
  const percentage = config.steps.slice(0, currentStepIndex).reduce((acc, step) => acc + step.weight, 0);
  const nextStep = config.steps[currentStepIndex];
  
  return {
    status: currentStepIndex > 0 ? "IN_PROGRESS" : "NOT_STARTED",
    completedSteps,
    currentStep: nextStep.key,
    nextStepKey: nextStep.key,
    percentage
  };
};
