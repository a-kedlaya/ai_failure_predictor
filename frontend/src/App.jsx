import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import Hero from './components/Hero'
import Dashboard from './components/Dashboard'
import './App.css'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const normalizeSkill = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
const replaceLineContent = (line, replacement) => {
  const prefixMatch = String(line || '').match(/^(\s*(?:[-*]\s+|\d+[.)]\s+))/)
  const prefix = prefixMatch ? prefixMatch[1] : ''
  return `${prefix}${replacement}`
}
const alignReasoningWithTeamFacts = (reasoning, teamSize, avgExperience, availableSkillsCount, availableSkills = [], totalRequiredSkills = 0, missingSkills = []) => {
  if (!reasoning) return reasoning
  let text = String(reasoning)
  text = text.replace(/\*\*(.+?)\*\*/g, '$1')
  const numericTeamSize = Number(teamSize) || 0
  const sizeLabel = numericTeamSize === 1 ? '1 developer' : `${numericTeamSize} developers`
  const isSingularTeam = numericTeamSize === 1
  const avgNumeric = Number(avgExperience || 0)
  const avgLabel = `${parseFloat(avgNumeric.toFixed(1))} years`
  const skillsCount = Number(availableSkillsCount) || 0
  const matchedSkills = Array.isArray(availableSkills) ? availableSkills.filter(Boolean) : []
  const missingCount = Array.isArray(missingSkills) ? missingSkills.length : 0
  const totalRequired = Number(totalRequiredSkills) || 0
  const missingPct = totalRequired > 0 ? Math.round((missingCount / totalRequired) * 100) : 0
  text = text.replace(
    /\bonly\s+one\s+developer\s+is\s+available\b/gi,
    `${sizeLabel} ${isSingularTeam ? 'is' : 'are'} available`
  )
  if (avgNumeric > 0) {
    text = text.replace(/\bboth\s+developers\s+have\s+zero\s+years\s+of\s+experience\b/gi, `${sizeLabel} have an average of ${avgLabel} of experience`)
    text = text.replace(/\bzero\s+years\s+of\s+experience\b/gi, `${avgLabel} of experience (average)`)
    text = text.replace(/\b0\s+years\s+of\s+experience\b/gi, `${avgLabel} of experience (average)`)
    text = text.replace(/\bhave\s+no\s+experience\b/gi, `have an average of ${avgLabel} of experience`)
    text = text.replace(/\bwith\s+no\s+experience\b/gi, `with an average of ${avgLabel} experience`)
    text = text.replace(/\bno\s+experience\b/gi, `${avgLabel} average experience`)
    text = text.replace(/\baverage\s+experience\s*:\s*0\s*years\b/gi, `average experience: ${avgLabel}`)
    text = text.replace(/\baverage\s+experience\s*:\s*0\.0\s*years\b/gi, `average experience: ${avgLabel}`)
    text = text.replace(/\bno\s+developers\s+have\s+experience\b/gi, `${sizeLabel} have an average of ${avgLabel} of experience`)
    text = text.replace(/\(average\)(?:\s*\(average\))+?/gi, '(average)')
    text = text.replace(/\b(\d+(?:\.\d+)?)\.0\s+years\b/gi, '$1 years')
  }
  if (skillsCount > 0) {
    text = text.replace(/-\s*None\s*\([^\n]*available\s*skills[^\n]*\)/gi, `- ${skillsCount} skill${skillsCount === 1 ? '' : 's'} identified from team profile.`)
    text = text.replace(/-\s*None\s*\([^\n]*\)/gi, `- ${skillsCount} skill${skillsCount === 1 ? '' : 's'} identified from team profile.`)
    text = text.replace(/\bavailable\s+skills\s*:\s*none\.?\b/gi, `available skills: ${skillsCount} identified`)
    text = text.replace(/\bno\s+available\s+skills\s+matching\s+the\s+project\s+requirements\b/gi, `${skillsCount} required skill${skillsCount === 1 ? '' : 's'} matched by the team profile`)
    text = text.replace(/\bno\s+available\s+skills\b/gi, `${skillsCount} available skill${skillsCount === 1 ? '' : 's'} identified`)
    text = text.replace(/\bno\s+relevant\s+skills\b/gi, `${skillsCount} team skill${skillsCount === 1 ? '' : 's'} available`)
    // Fix "Missing Skills: All required skills" or "All required skills are missing"
    text = text.replace(/\bmissing\s+skills\s*:\s*all\s+required\s+skills\.?\b/gi,
      `Missing Skills: ${missingCount} of ${totalRequired} required skills (${matchedSkills.join(', ')} covered by team).`)
    text = text.replace(/\ball\s+required\s+skills\s+are\s+missing\b/gi,
      `${missingCount} of ${totalRequired} required skills are missing (${skillsCount} covered)`)
    text = text.replace(/\ball\s+(?:required\s+)?skills\s+(?:are\s+)?(?:entirely\s+)?missing\b/gi,
      `${missingCount} of ${totalRequired} required skills are missing (${skillsCount} covered)`)
    // Fix "100% of required skills are missing"
    text = text.replace(/\b100\s*%\s+of\s+(?:required\s+)?skills\s+are\s+missing\b/gi,
      `${missingPct}% of required skills are missing (${skillsCount} of ${totalRequired} covered)`)
    // Fix "lacks all required skills" / "missing all required skills"
    text = text.replace(/\b(?:lacks?|missing)\s+all\s+(?:the\s+)?required\s+(?:technical\s+)?skills\b/gi,
      `missing ${missingCount} of ${totalRequired} required skills (${skillsCount} covered)`)
    // Fix "including critical technologies like X, Y, Z" when some of those are actually available
    if (matchedSkills.length > 0) {
      text = text.replace(
        /\b(?:including\s+critical\s+(?:technologies|skills)\s+like\s+)([^.]+)/gi,
        (match, skillList) => {
          const mentioned = skillList.split(/,\s*/).map(s => s.trim().toLowerCase())
          const actuallyMissing = mentioned.filter(s =>
            !matchedSkills.some(ms => ms.toLowerCase() === s)
          )
          if (actuallyMissing.length === 0) return ''
          if (actuallyMissing.length < mentioned.length) {
            return `including ${actuallyMissing.join(', ')}`
          }
          return match
        }
      )
    }
  }
  const zeroSkillClaimRegex = /(?:\bavailable\s+skills\s*:\s*none\.?\b|\b(?:no|none|zero)\s+(?:available\s+)?(?:relevant\s+)?(?:required\s+)?(?:technical\s+)?(?:skills?|expertise|capabilities?|competencies)\b|\bteam\s+lacks?\s+(?:all|any)\s+(?:required\s+)?(?:technical\s+)?(?:skills?|expertise)\b|\b(?:complete|total)\s+absence\s+of\s+(?:the\s+)?(?:required\s+)?(?:technical\s+)?(?:skills?|expertise)\b|\ball\s+(?:required\s+)?(?:skills?|technologies)\b[^.\n]*\bare\s+missing\b)/i
  const zeroExperienceClaimRegex = /(?:\b(?:no|none|zero|0)\s+years?\s+of\s+experience\b|\b(?:no|none)\s+experience\b|\bdevelopers?\s+(?:are|is)\s+inexperienced\b)/i
  const lines = text.split(/\r?\n/)
  let inAvailableSkillsSection = false
  text = lines
    .map((line, index) => {
      const trimmedLine = line.trim()
      if (!trimmedLine) return line
      const normalizedCurrent = trimmedLine.toLowerCase()
      const previousLine = index > 0 ? String(lines[index - 1] || '').trim().toLowerCase() : ''
      if (/^#{1,6}\s*available\s+skills/i.test(trimmedLine) || /^\*\*\s*available\s+skills/i.test(trimmedLine) || /^available\s+skills/i.test(normalizedCurrent)) {
        inAvailableSkillsSection = true
      } else if (/^#{1,6}\s+/i.test(trimmedLine) && !/available\s+skills/i.test(trimmedLine)) {
        inAvailableSkillsSection = false
      } else if (/^\*\*[^*]+\*\*$/i.test(trimmedLine) && !/available\s+skills/i.test(trimmedLine)) {
        inAvailableSkillsSection = false
      }
      if (
        skillsCount > 0
        && /^(?:[-*]\s*)?(?:none|n\/a|not\s+available)\.?\s*$/i.test(trimmedLine)
        && (inAvailableSkillsSection || /available\s+skills/i.test(previousLine))
      ) {
        const skillText = matchedSkills.length
          ? matchedSkills.join(', ')
          : `${skillsCount} skill${skillsCount === 1 ? '' : 's'} identified`
        return replaceLineContent(line, skillText)
      }
      if (skillsCount > 0 && zeroSkillClaimRegex.test(trimmedLine)) {
        return replaceLineContent(
          line,
          `${skillsCount} required skill${skillsCount === 1 ? '' : 's'} are covered by current team profile.`
        )
      }
      if (avgNumeric > 0 && zeroExperienceClaimRegex.test(trimmedLine)) {
        return replaceLineContent(
          line,
          `${sizeLabel} have an average of ${avgLabel} of experience.`
        )
      }
      return line
    })
    .join('\n')
  return text
}
function App() {
  const [isDashboardVisible, setIsDashboardVisible] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [progress, setProgress] = useState(0)
  const dashboardRef = useRef(null)
  useEffect(() => {
    if (isDashboardVisible && dashboardRef.current) {
      dashboardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [isDashboardVisible])
  useEffect(() => {
    if (isLoading) {
      setProgress(0)
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) { clearInterval(interval); return 90 }
          return prev + Math.random() * 15
        })
      }, 500)
      return () => clearInterval(interval)
    } else {
      if (isDashboardVisible) setProgress(100)
    }
  }, [isLoading])
  const handleAnalyze = async (requirementsFile, teamInput) => {
    setIsLoading(true)
    setStatusMessage('Analyzing project requirements...')
    setIsError(false)
    setIsDashboardVisible(false)
    try {
      const formData = new FormData()
      formData.append('requirements', requirementsFile)
      const mode = teamInput?.teamInputMode || 'manual'
      const manualTeamData = Array.isArray(teamInput?.teamData) ? teamInput.teamData : []
      const teamFile = teamInput?.teamFile || null
      if (mode === 'excel' && teamFile) {
        formData.append('team', teamFile)
      } else {
        formData.append('team_json', JSON.stringify(manualTeamData))
      }
      const response = await fetch(`${API_BASE_URL}/api/analyze/`, {
        method: 'POST',
        body: formData,
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      })
      const contentType = response.headers.get('content-type') || ''
      const data = contentType.includes('application/json')
        ? await response.json()
        : { error: `Server returned ${response.status} ${response.statusText}`, details: await response.text() }
      if (!response.ok || data.error) {
        throw new Error(data.details || data.error || 'Analysis failed')
      }
      const baseReport = data.report || data
      const requiredSkills = (Array.isArray(baseReport.requiredSkills) ? baseReport.requiredSkills : [])
        .filter((s) => !/^\d+(\.\d+)*$/.test(String(s || '').trim()))
      const effectiveTeamData = Array.isArray(baseReport.teamData)
        ? baseReport.teamData
        : (Array.isArray(data.teamData) ? data.teamData : manualTeamData)
      const derivedTeamSize = effectiveTeamData.length
      const derivedAvgExperience = derivedTeamSize
        ? (effectiveTeamData.reduce((sum, member) => sum + (Number(member.experience) || 0), 0) / derivedTeamSize)
        : 0
      const typedTeamSkills = new Set(
        effectiveTeamData
          .flatMap((member) => (Array.isArray(member.skills) ? member.skills : []))
          .map(normalizeSkill)
          .filter(Boolean)
      )
      const normalizedRequiredSkills = requiredSkills.map((skill) => ({
        original: skill,
        normalized: normalizeSkill(skill),
      }))
      const computedAvailableSkills = normalizedRequiredSkills
        .filter((skill) => typedTeamSkills.has(skill.normalized))
        .map((skill) => skill.original)
        .filter((s) => !/^\d+(\.\d+)*$/.test(s.trim()))
      const availableSkillsCount = computedAvailableSkills.length
      const computedMissingSkills = normalizedRequiredSkills
        .filter((skill) => !typedTeamSkills.has(skill.normalized))
        .map((skill) => skill.original)
        .filter((s) => !/^\d+(\.\d+)*$/.test(s.trim()))
      const mergedReport = {
        ...baseReport,
        requiredSkills: requiredSkills,
        teamData: effectiveTeamData,
        developers: derivedTeamSize || baseReport.developers || 0,
        avgExperience: derivedTeamSize ? parseFloat(derivedAvgExperience.toFixed(1)) : (baseReport.avgExperience || 0),
        availableSkills: requiredSkills.length ? computedAvailableSkills : (baseReport.availableSkills || []),
        missingSkills: requiredSkills.length ? computedMissingSkills : (baseReport.missingSkills || []),
      }
      mergedReport.aiReasoning = alignReasoningWithTeamFacts(
        mergedReport.aiReasoning,
        mergedReport.developers,
        mergedReport.avgExperience,
        availableSkillsCount,
        mergedReport.availableSkills,
        requiredSkills.length,
        computedMissingSkills
      )
      setReportData(mergedReport)
      setIsDashboardVisible(true)
      setStatusMessage('Analysis complete.')
      // Save corrected report to backend so PDF matches UI
      try {
        await fetch(`${API_BASE_URL}/api/save-report/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ report: mergedReport, project_name: requirementsFile?.name?.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ') || 'Untitled Project' }),
        })
      } catch (e) {
        // Non-critical - PDF will still work with raw report
      }
    } catch (error) {
      console.error('Fetch error:', error)
      setStatusMessage(error.message || 'Failed to fetch from server.')
      setIsError(true)
      setIsDashboardVisible(false)
    } finally {
      setIsLoading(false)
    }
  }
  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <header className="border-b border-gray-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900 tracking-tight">AI Project Risk Intelligence</span>
          </div>
          <div className="flex items-center gap-3">
            {isDashboardVisible ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer border border-slate-700"
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE_URL}/download-report/`)
                    if (!res.ok) throw new Error('Failed')
                    const blob = await res.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'Project_Risk_Report.pdf'
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    URL.revokeObjectURL(url)
                  } catch {
                    alert('Failed to download PDF.')
                  }
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Download Report
              </button>
            ) : (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                AI Powered
              </span>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5">
        {/* Progress Bar */}
        {isLoading && (
          <div className="fixed top-12 left-0 right-0 z-40">
            <div className="h-1 bg-gray-100">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-700 ease-out rounded-r-full"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        )}
        <Hero
          onAnalyze={handleAnalyze}
          isLoading={isLoading}
          statusMessage={statusMessage}
          isError={isError}
          analysisComplete={isDashboardVisible}
        />
        {isDashboardVisible && reportData && (
          <div ref={dashboardRef} className="animate-fade-in mt-2">
            <Dashboard report={reportData} />
          </div>
        )}
      </main>
    </div>
  )
}
export default App
