/**
 * Example: Voice Survey Component
 * 
 * This is a sample React component demonstrating how to use the useVoiceSurvey hook.
 * 
 * Usage:
 * import VoiceSurveyExample from './hooks/VoiceSurveyExample';
 * 
 * To use this component, add it to your app:
 * <VoiceSurveyExample />
 */

import { useVoiceSurvey } from './useVoiceSurvey';
import type { SurveyNode } from '@hail-mary/surveyor-engine';

// Import the sample schema
import boilerSurveySchemaJson from '@hail-mary/surveyor-engine/dist/../src/samples/boiler-survey.json';
const boilerSurveySchema = boilerSurveySchemaJson as SurveyNode[];

export function VoiceSurveyExample() {
  const {
    currentQuestion,
    isListening,
    isSpeaking,
    startSurvey,
    manualSubmit,
    stopListening,
    surveyState,
    error
  } = useVoiceSurvey({
    schema: boilerSurveySchema,
    onComplete: (answers) => {
      console.log('Survey completed!', answers);
      alert('Survey completed! Check console for answers.');
    },
    language: 'en-US',
    autoListen: true
  });

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Voice Survey Demo</h1>
      
      {error && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#fee', 
          border: '1px solid #f88',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!surveyState.started && (
        <button 
          onClick={startSurvey}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Start Voice Survey
        </button>
      )}

      {surveyState.started && !surveyState.completed && currentQuestion && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h2>Current Question:</h2>
            <p style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {currentQuestion.promptText}
            </p>
            <p style={{ color: '#666' }}>
              Type: {currentQuestion.inputType}
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            {isSpeaking && (
              <div style={{ color: '#007bff' }}>
                🔊 Speaking...
              </div>
            )}
            {isListening && (
              <div style={{ color: '#28a745' }}>
                🎤 Listening...
              </div>
            )}
          </div>

          {/* Manual input options */}
          <div style={{ marginBottom: '20px' }}>
            <h3>Manual Input:</h3>
            
            {currentQuestion.inputType === 'boolean' && (
              <div>
                <button 
                  onClick={() => manualSubmit(true)}
                  style={{
                    padding: '10px 20px',
                    marginRight: '10px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Yes
                </button>
                <button 
                  onClick={() => manualSubmit(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  No
                </button>
              </div>
            )}

            {currentQuestion.inputType === 'number' && (
              <div>
                <input 
                  type="number" 
                  placeholder="Enter a number"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const value = parseInt((e.target as HTMLInputElement).value);
                      if (!isNaN(value)) {
                        manualSubmit(value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                  style={{
                    padding: '10px',
                    fontSize: '16px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    width: '200px'
                  }}
                />
                <p style={{ fontSize: '14px', color: '#666' }}>
                  Press Enter to submit
                </p>
              </div>
            )}

            {currentQuestion.inputType === 'text' && (
              <div>
                <input 
                  type="text" 
                  placeholder="Enter text"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const value = (e.target as HTMLInputElement).value;
                      if (value) {
                        manualSubmit(value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                  style={{
                    padding: '10px',
                    fontSize: '16px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    width: '300px'
                  }}
                />
                <p style={{ fontSize: '14px', color: '#666' }}>
                  Press Enter to submit
                </p>
              </div>
            )}
          </div>

          {isListening && (
            <button 
              onClick={stopListening}
              style={{
                padding: '10px 20px',
                backgroundColor: '#ffc107',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Stop Listening
            </button>
          )}
        </div>
      )}

      {surveyState.completed && (
        <div style={{
          padding: '20px',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '4px'
        }}>
          <h2>Survey Completed! ✅</h2>
          <h3>Collected Answers:</h3>
          <pre style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '10px', 
            borderRadius: '4px',
            overflow: 'auto'
          }}>
            {JSON.stringify(surveyState.answers, null, 2)}
          </pre>
        </div>
      )}

      {surveyState.started && (
        <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #ccc' }}>
          <h3>Debug Info:</h3>
          <p>Survey Started: {surveyState.started ? 'Yes' : 'No'}</p>
          <p>Survey Completed: {surveyState.completed ? 'Yes' : 'No'}</p>
          <p>Current Answers: {Object.keys(surveyState.answers).length}</p>
        </div>
      )}
    </div>
  );
}
