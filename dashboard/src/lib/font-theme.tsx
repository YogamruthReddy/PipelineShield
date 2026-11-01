"use client";

import React, { createContext, useContext } from "react";
import {
  TypographyRoleId,
  TypographyRole,
  TYPOGRAPHY_ROLES,
  FontCategory,
  FontOption,
  FONT_OPTIONS,
  STORAGE_KEY,
  DEFAULT_FONT_ID,
} from "./font-config";

export type { TypographyRoleId, TypographyRole, FontCategory, FontOption };
export { TYPOGRAPHY_ROLES, FONT_OPTIONS, STORAGE_KEY, DEFAULT_FONT_ID };

interface TypographyContextType {
  roles: TypographyRole[];
  currentFont: FontOption;
}

const TypographyContext = createContext<TypographyContextType>({
  roles: TYPOGRAPHY_ROLES,
  currentFont: FONT_OPTIONS[0],
});

/**
 * Role-Based Typography System Provider
 * Governed deterministically via CSS custom properties on :root and @theme.
 * Zero user-facing font switching or localStorage mutation.
 */
export function FontProvider({ children }: { children: React.ReactNode }) {
  return (
    <TypographyContext.Provider
      value={{
        roles: TYPOGRAPHY_ROLES,
        currentFont: FONT_OPTIONS[0],
      }}
    >
      {children}
    </TypographyContext.Provider>
  );
}

export function useFont() {
  return useContext(TypographyContext);
}
