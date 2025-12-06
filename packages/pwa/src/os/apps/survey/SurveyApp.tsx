import React, { useState, useEffect } from 'react'
import type { 
  SurveyTemplate,
  SurveyQuestion,
} from '@hail-mary/shared'
import './SurveyApp.css'

// Sample survey template for demo
const sampleTemplate: SurveyTemplate = {
  id: 1,
  accountId: 1,
  name: 'Boiler Survey',
  description: 'Standard boiler replacement survey',
  createdAt: new Date(),
  updatedAt: new Date(),
  schema: {
    sections: [
      {
        id: 'property',
        label: 'Property Details',
        questions: [
          { id: 'propertyType', label: 'Property Type', type: 'single_choice', options: ['House', 'Flat', 'Bungalow', 'Commercial'], required: true },
          { id: 'bedrooms', label: 'Number of Bedrooms', type: 'number', required: true },
          { id: 'bathrooms', label: 'Number of Bathrooms', type: 'number', required: true },
        ],
      },
      {
        id: 'currentSystem',
        label: 'Current Heating System',
        questions: [
          { id: 'boilerType', label: 'Current Boiler Type', type: 'single_choice', options: ['Combi', 'System', 'Heat Only', 'Back Boiler', 'None'], required: true },
          { id: 'boilerAge', label: 'Approximate Boiler Age (years)', type: 'number' },
          { id: 'boilerLocation', label: 'Boiler Location', type: 'text' },
          { id: 'flueType', label: 'Flue Type', type: 'single_choice', options: ['Horizontal', 'Vertical', 'Internal', 'Unknown'] },
        ],
      },
      {
        id: 'requirements',
        label: 'Customer Requirements',
        questions: [
          { id: 'preferredBoilerType', label: 'Preferred Boiler Type', type: 'single_choice', options: ['Combi', 'System', 'Heat Only', 'No Preference'] },
          { id: 'smartControls', label: 'Smart Controls Required?', type: 'boolean' },
          { id: 'additionalWorks', label: 'Additional Works Needed', type: 'multiple_choice', options: ['Pipework', 'Radiators', 'Cylinder', 'Controls', 'None'] },
          { id: 'notes', label: 'Additional Notes', type: 'text' },
        ],
      },
    ],
  },
}

type ViewMode = 'templates' | 'survey'

interface SurveyAnswers {
  [questionId: string]: string | number | boolean | string[]
}

export const SurveyApp: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('templates')
  const [templates] = useState<SurveyTemplate[]>([sampleTemplate])
  const [activeTemplate, setActiveTemplate] = useState<SurveyTemplate | null>(null)
  const [answers, setAnswers] = useState<SurveyAnswers>({})
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // In production, load templates from API
    // api.get<PaginatedResponse<SurveyTemplate>>('/api/survey-templates')
  }, [])

  const startSurvey = (template: SurveyTemplate) => {
    setActiveTemplate(template)
    setAnswers({})
    setCurrentSectionIndex(0)
    setViewMode('survey')
    setSaved(false)
  }

  const handleBackToTemplates = () => {
    setViewMode('templates')
    setActiveTemplate(null)
    setAnswers({})
    setCurrentSectionIndex(0)
  }

  const updateAnswer = (questionId: string, value: string | number | boolean | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      // In production, save to API
      // await api.post('/api/survey-answers', { templateId: activeTemplate?.id, answers })
      await new Promise(resolve => setTimeout(resolve, 500)) // Simulate API call
      setSaved(true)
    } finally {
      setLoading(false)
    }
  }

  const renderQuestion = (question: SurveyQuestion) => {
    const value = answers[question.id]

    switch (question.type) {
      case 'text':
        return (
          <textarea
            value={(value as string) || ''}
            onChange={e => updateAnswer(question.id, e.target.value)}
            placeholder={`Enter ${question.label.toLowerCase()}...`}
            rows={3}
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={(value as number) || ''}
            onChange={e => updateAnswer(question.id, parseInt(e.target.value, 10) || 0)}
            min={0}
          />
        )

      case 'boolean':
        return (
          <div className="boolean-toggle">
            <button
              className={`toggle-btn ${value === true ? 'active' : ''}`}
              onClick={() => updateAnswer(question.id, true)}
            >
              Yes
            </button>
            <button
              className={`toggle-btn ${value === false ? 'active' : ''}`}
              onClick={() => updateAnswer(question.id, false)}
            >
              No
            </button>
          </div>
        )

      case 'single_choice':
        return (
          <div className="choice-group">
            {question.options?.map(option => (
              <button
                key={option}
                className={`choice-btn ${value === option ? 'active' : ''}`}
                onClick={() => updateAnswer(question.id, option)}
              >
                {option}
              </button>
            ))}
          </div>
        )

      case 'multiple_choice':
        const selectedOptions = (value as string[]) || []
        return (
          <div className="choice-group multiple">
            {question.options?.map(option => (
              <button
                key={option}
                className={`choice-btn ${selectedOptions.includes(option) ? 'active' : ''}`}
                onClick={() => {
                  const newSelected = selectedOptions.includes(option)
                    ? selectedOptions.filter(o => o !== option)
                    : [...selectedOptions, option]
                  updateAnswer(question.id, newSelected)
                }}
              >
                {selectedOptions.includes(option) ? '✓ ' : ''}{option}
              </button>
            ))}
          </div>
        )

      default:
        return <input type="text" value={(value as string) || ''} onChange={e => updateAnswer(question.id, e.target.value)} />
    }
  }

  // Survey view
  if (viewMode === 'survey' && activeTemplate) {
    const sections = activeTemplate.schema.sections
    const currentSection = sections[currentSectionIndex]
    const isFirstSection = currentSectionIndex === 0
    const isLastSection = currentSectionIndex === sections.length - 1
    const progress = ((currentSectionIndex + 1) / sections.length) * 100

    return (
      <div className="survey-app">
        <div className="survey-app-header">
          <button className="btn-back" onClick={handleBackToTemplates}>
            ← Exit
          </button>
          <h2>{activeTemplate.name}</h2>
        </div>

        {/* Progress Bar */}
        <div className="survey-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-text">
            Section {currentSectionIndex + 1} of {sections.length}
          </span>
        </div>

        {/* Section Content */}
        <div className="survey-section">
          <h3>{currentSection.label}</h3>
          
          <div className="survey-questions">
            {currentSection.questions.map(question => (
              <div key={question.id} className="survey-question">
                <label>
                  {question.label}
                  {question.required && <span className="required">*</span>}
                </label>
                {renderQuestion(question)}
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="survey-navigation">
          <button
            className="btn-secondary"
            onClick={() => setCurrentSectionIndex(prev => prev - 1)}
            disabled={isFirstSection}
          >
            ← Previous
          </button>

          {isLastSection ? (
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={loading || saved}
            >
              {loading ? 'Saving...' : saved ? '✓ Saved' : 'Save Survey'}
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={() => setCurrentSectionIndex(prev => prev + 1)}
            >
              Next →
            </button>
          )}
        </div>
      </div>
    )
  }

  // Template list view
  return (
    <div className="survey-app">
      <div className="survey-app-header">
        <h2>🧩 Survey Templates</h2>
      </div>

      <div className="templates-list">
        {templates.length === 0 ? (
          <p className="templates-empty">No survey templates available.</p>
        ) : (
          templates.map(template => (
            <button
              key={template.id}
              className="template-item"
              onClick={() => startSurvey(template)}
            >
              <div className="template-info">
                <strong>{template.name}</strong>
                {template.description && <span>{template.description}</span>}
                <span className="template-meta">
                  {template.schema.sections.length} sections • 
                  {template.schema.sections.reduce((acc: number, s: any) => acc + s.questions.length, 0)} questions
                </span>
              </div>
              <span className="template-arrow">→</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
