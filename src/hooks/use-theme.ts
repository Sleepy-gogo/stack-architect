import { useEffect, useState } from "react"

const THEME_KEY = "tech-stack-architect:theme"

function readStoredTheme(): boolean {
  if (typeof window === "undefined") return false
  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === "dark") return true
  if (stored === "light") return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

/**
 * Dark-mode state persisted across sessions and applied to the document.
 * The effect synchronizes React with two external systems: the `.dark`
 * class/color-scheme the CSS layer reads, and localStorage.
 */
export function useTheme(): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [dark, setDark] = useState(readStoredTheme)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    document.documentElement.style.colorScheme = dark ? "dark" : "light"
    window.localStorage.setItem(THEME_KEY, dark ? "dark" : "light")
  }, [dark])

  return [dark, setDark]
}
