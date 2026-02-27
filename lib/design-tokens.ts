/**
 * Design System Tokens
 * Centralized values for consistent UI across the application
 */

export const designTokens = {
  // Typography Hierarchy
  typography: {
    // Headings
    h1: "text-2xl md:text-4xl font-bold tracking-tight", // Page titles
    h2: "text-xl md:text-2xl font-semibold", // Section headings
    h3: "text-base md:text-lg font-medium", // Card titles, subsections

    // Body text
    body: "text-base", // Normal text
    bodyMuted: "text-sm md:text-base text-muted-foreground", // Secondary text
    small: "text-sm", // Labels, descriptions
    smallMuted: "text-sm text-muted-foreground", // Helper text
    xs: "text-xs text-muted-foreground", // Tiny helper text

    // Special
    statNumber: "text-2xl md:text-3xl font-bold", // Statistics/numbers
  },

  // Icon System - Standardized sizes
  icons: {
    sm: "h-4 w-4", // Only for inline text icons
    md: "h-5 w-5", // Standard size - use everywhere
    lg: "h-6 w-6", // Rarely used, only for emphasis
  },

  // Icon containers - Always same size
  iconContainer: "p-2 rounded-lg",

  // Icon background colors
  iconBackgrounds: {
    blue: "bg-blue-500/10",
    green: "bg-green-500/10",
    red: "bg-red-500/10",
    purple: "bg-purple-500/10",
    orange: "bg-orange-500/10",
    primary: "bg-primary/10",
    muted: "bg-muted/50",
  },

  // Icon text colors
  iconColors: {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-green-600 dark:text-green-400",
    red: "text-red-600 dark:text-red-400",
    purple: "text-purple-600 dark:text-purple-400",
    orange: "text-orange-600 dark:text-orange-400",
    primary: "text-primary",
    muted: "text-muted-foreground",
  },

  // Spacing
  spacing: {
    pageSection: "space-y-6 md:space-y-12", // Between major page sections
    cardSection: "space-y-6 md:space-y-8", // Within card sections
    formGroup: "space-y-4 md:space-y-6", // Between form groups
    inputGroup: "space-y-3", // Within input groups
    cardGap: "gap-3 md:gap-6", // Grid gaps
  },

  // Component sizes
  components: {
    button: "h-10 md:h-12 px-4 md:px-6 text-sm md:text-base font-semibold",
    input: "h-10 md:h-12 text-sm md:text-base",
    cardPadding: "pb-4",
  },

  // Cards
  cards: {
    default: "border-none shadow-sm hover:shadow-md transition-shadow",
    elevated: "border-none shadow-lg",
  },
} as const;
