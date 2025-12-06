/**
 * Tests for SurveyEngine
 */

import { SurveyEngine } from '../engine';
import type { SurveyNode } from '../types';

describe('SurveyEngine', () => {
  // Sample survey schema for testing
  const sampleSchema: SurveyNode[] = [
    {
      id: 'start',
      prompt: 'Do you need a new boiler?',
      expectedInput: 'boolean',
      paths: [
        { condition: 'answer === true', nextId: 'boiler_type' },
        { condition: 'answer === false', nextId: 'end' },
      ],
    },
    {
      id: 'boiler_type',
      prompt: 'What type of boiler do you need?',
      expectedInput: 'text',
      paths: [
        { condition: 'default', nextId: 'property_size' },
      ],
    },
    {
      id: 'property_size',
      prompt: 'How many bedrooms does your property have?',
      expectedInput: 'number',
      validation: { min: 1, max: 10 },
      paths: [
        { condition: 'answer > 3', nextId: 'large_property' },
        { condition: 'answer <= 3', nextId: 'small_property' },
      ],
    },
    {
      id: 'large_property',
      prompt: 'You have a large property.',
      expectedInput: 'boolean',
      paths: [],
    },
    {
      id: 'small_property',
      prompt: 'You have a small property.',
      expectedInput: 'boolean',
      paths: [],
    },
    {
      id: 'end',
      prompt: 'Thank you for your time.',
      expectedInput: 'boolean',
      paths: [],
    },
  ];

  describe('constructor', () => {
    it('should create an instance with valid schema', () => {
      const engine = new SurveyEngine(sampleSchema);
      expect(engine).toBeInstanceOf(SurveyEngine);
    });

    it('should throw error with empty schema', () => {
      expect(() => new SurveyEngine([])).toThrow('Survey schema cannot be empty');
    });

    it('should throw error with null schema', () => {
      expect(() => new SurveyEngine(null as any)).toThrow('Survey schema cannot be empty');
    });
  });

  describe('start', () => {
    it('should return the first node', () => {
      const engine = new SurveyEngine(sampleSchema);
      const firstNode = engine.start();
      
      expect(firstNode.id).toBe('start');
      expect(firstNode.prompt).toBe('Do you need a new boiler?');
    });

    it('should set initial state', () => {
      const engine = new SurveyEngine(sampleSchema);
      engine.start();
      
      const state = engine.getState();
      expect(state.currentNodeId).toBe('start');
      expect(state.isComplete).toBe(false);
      expect(state.history).toEqual({});
    });
  });

  describe('submitAnswer', () => {
    describe('validation', () => {
      it('should accept valid boolean answer', () => {
        const engine = new SurveyEngine(sampleSchema);
        engine.start();
        
        expect(() => engine.submitAnswer(true)).not.toThrow();
      });

      it('should reject invalid boolean answer', () => {
        const engine = new SurveyEngine(sampleSchema);
        engine.start();
        
        expect(() => engine.submitAnswer('yes')).toThrow('Expected boolean');
      });

      it('should accept valid number answer', () => {
        const schema: SurveyNode[] = [
          {
            id: 'age',
            prompt: 'What is your age?',
            expectedInput: 'number',
            paths: [],
          },
        ];
        const engine = new SurveyEngine(schema);
        engine.start();
        
        expect(() => engine.submitAnswer(25)).not.toThrow();
      });

      it('should reject invalid number answer', () => {
        const schema: SurveyNode[] = [
          {
            id: 'age',
            prompt: 'What is your age?',
            expectedInput: 'number',
            paths: [],
          },
        ];
        const engine = new SurveyEngine(schema);
        engine.start();
        
        expect(() => engine.submitAnswer('twenty-five')).toThrow('Expected number');
      });

      it('should accept valid text answer', () => {
        const engine = new SurveyEngine(sampleSchema);
        engine.start();
        engine.submitAnswer(true); // Move to boiler_type
        
        expect(() => engine.submitAnswer('Combi')).not.toThrow();
      });

      it('should reject invalid text answer', () => {
        const engine = new SurveyEngine(sampleSchema);
        engine.start();
        engine.submitAnswer(true); // Move to boiler_type
        
        expect(() => engine.submitAnswer(123)).toThrow('Expected text');
      });

      it('should accept valid date as Date object', () => {
        const schema: SurveyNode[] = [
          {
            id: 'install_date',
            prompt: 'When do you want installation?',
            expectedInput: 'date',
            paths: [],
          },
        ];
        const engine = new SurveyEngine(schema);
        engine.start();
        
        expect(() => engine.submitAnswer(new Date())).not.toThrow();
      });

      it('should accept valid date as ISO string', () => {
        const schema: SurveyNode[] = [
          {
            id: 'install_date',
            prompt: 'When do you want installation?',
            expectedInput: 'date',
            paths: [],
          },
        ];
        const engine = new SurveyEngine(schema);
        engine.start();
        
        expect(() => engine.submitAnswer('2024-01-15')).not.toThrow();
      });

      it('should reject invalid date string', () => {
        const schema: SurveyNode[] = [
          {
            id: 'install_date',
            prompt: 'When do you want installation?',
            expectedInput: 'date',
            paths: [],
          },
        ];
        const engine = new SurveyEngine(schema);
        engine.start();
        
        expect(() => engine.submitAnswer('not-a-date')).toThrow('Invalid date string');
      });

      it('should enforce min validation on numbers', () => {
        const engine = new SurveyEngine(sampleSchema);
        engine.start();
        engine.submitAnswer(true); // Move to boiler_type
        engine.submitAnswer('Combi'); // Move to property_size
        
        expect(() => engine.submitAnswer(0)).toThrow('below minimum');
      });

      it('should enforce max validation on numbers', () => {
        const engine = new SurveyEngine(sampleSchema);
        engine.start();
        engine.submitAnswer(true); // Move to boiler_type
        engine.submitAnswer('Combi'); // Move to property_size
        
        expect(() => engine.submitAnswer(11)).toThrow('exceeds maximum');
      });

      it('should enforce regex validation on text', () => {
        const schema: SurveyNode[] = [
          {
            id: 'email',
            prompt: 'What is your email?',
            expectedInput: 'text',
            validation: { regex: '^[^@]+@[^@]+\\.[^@]+$' },
            paths: [],
          },
        ];
        const engine = new SurveyEngine(schema);
        engine.start();
        
        expect(() => engine.submitAnswer('invalid-email')).toThrow('does not match required pattern');
        expect(() => engine.submitAnswer('valid@email.com')).not.toThrow();
      });
    });

    describe('path evaluation', () => {
      it('should follow true path for boolean', () => {
        const engine = new SurveyEngine(sampleSchema);
        engine.start();
        
        const nextNode = engine.submitAnswer(true);
        expect(nextNode?.id).toBe('boiler_type');
      });

      it('should follow false path for boolean', () => {
        const engine = new SurveyEngine(sampleSchema);
        engine.start();
        
        const nextNode = engine.submitAnswer(false);
        expect(nextNode?.id).toBe('end');
      });

      it('should follow default path', () => {
        const engine = new SurveyEngine(sampleSchema);
        engine.start();
        engine.submitAnswer(true);
        
        const nextNode = engine.submitAnswer('System');
        expect(nextNode?.id).toBe('property_size');
      });

      it('should follow conditional path based on number comparison (greater than)', () => {
        const engine = new SurveyEngine(sampleSchema);
        engine.start();
        engine.submitAnswer(true);
        engine.submitAnswer('Combi');
        
        const nextNode = engine.submitAnswer(5);
        expect(nextNode?.id).toBe('large_property');
      });

      it('should follow conditional path based on number comparison (less than or equal)', () => {
        const engine = new SurveyEngine(sampleSchema);
        engine.start();
        engine.submitAnswer(true);
        engine.submitAnswer('Combi');
        
        const nextNode = engine.submitAnswer(2);
        expect(nextNode?.id).toBe('small_property');
      });

      it('should return null when no paths are defined (survey complete)', () => {
        const engine = new SurveyEngine(sampleSchema);
        engine.start();
        engine.submitAnswer(false); // Go to end
        
        const result = engine.submitAnswer(true);
        expect(result).toBeNull();
      });

      it('should mark survey as complete when no next node', () => {
        const engine = new SurveyEngine(sampleSchema);
        engine.start();
        engine.submitAnswer(false);
        engine.submitAnswer(true);
        
        const state = engine.getState();
        expect(state.isComplete).toBe(true);
      });

      it('should throw error if next node not found in schema', () => {
        const schema: SurveyNode[] = [
          {
            id: 'start',
            prompt: 'Start',
            expectedInput: 'boolean',
            paths: [
              { condition: 'default', nextId: 'nonexistent' },
            ],
          },
        ];
        const engine = new SurveyEngine(schema);
        engine.start();
        
        expect(() => engine.submitAnswer(true)).toThrow('Next node with id "nonexistent" not found');
      });
    });

    describe('history tracking', () => {
      it('should store answers in history', () => {
        const engine = new SurveyEngine(sampleSchema);
        engine.start();
        engine.submitAnswer(true);
        engine.submitAnswer('Combi');
        engine.submitAnswer(3);
        
        const state = engine.getState();
        expect(state.history).toEqual({
          start: true,
          boiler_type: 'Combi',
          property_size: 3,
        });
      });
    });
  });

  describe('getState', () => {
    it('should return a copy of the state', () => {
      const engine = new SurveyEngine(sampleSchema);
      engine.start();
      
      const state1 = engine.getState();
      const state2 = engine.getState();
      
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different objects
    });
  });

  describe('complex path conditions', () => {
    it('should handle >= operator', () => {
      const schema: SurveyNode[] = [
        {
          id: 'age_check',
          prompt: 'What is your age?',
          expectedInput: 'number',
          paths: [
            { condition: 'answer >= 18', nextId: 'adult' },
            { condition: 'answer < 18', nextId: 'minor' },
          ],
        },
        {
          id: 'adult',
          prompt: 'You are an adult',
          expectedInput: 'boolean',
          paths: [],
        },
        {
          id: 'minor',
          prompt: 'You are a minor',
          expectedInput: 'boolean',
          paths: [],
        },
      ];
      
      const engine = new SurveyEngine(schema);
      engine.start();
      
      const nextNode = engine.submitAnswer(18);
      expect(nextNode?.id).toBe('adult');
    });

    it('should handle <= operator', () => {
      const schema: SurveyNode[] = [
        {
          id: 'age_check',
          prompt: 'What is your age?',
          expectedInput: 'number',
          paths: [
            { condition: 'answer <= 17', nextId: 'minor' },
            { condition: 'answer > 17', nextId: 'adult' },
          ],
        },
        {
          id: 'adult',
          prompt: 'You are an adult',
          expectedInput: 'boolean',
          paths: [],
        },
        {
          id: 'minor',
          prompt: 'You are a minor',
          expectedInput: 'boolean',
          paths: [],
        },
      ];
      
      const engine = new SurveyEngine(schema);
      engine.start();
      
      const nextNode = engine.submitAnswer(17);
      expect(nextNode?.id).toBe('minor');
    });

    it('should handle === operator', () => {
      const schema: SurveyNode[] = [
        {
          id: 'confirm',
          prompt: 'Do you confirm?',
          expectedInput: 'boolean',
          paths: [
            { condition: 'answer === true', nextId: 'confirmed' },
            { condition: 'answer === false', nextId: 'denied' },
          ],
        },
        {
          id: 'confirmed',
          prompt: 'Confirmed',
          expectedInput: 'boolean',
          paths: [],
        },
        {
          id: 'denied',
          prompt: 'Denied',
          expectedInput: 'boolean',
          paths: [],
        },
      ];
      
      const engine = new SurveyEngine(schema);
      engine.start();
      
      const nextNode = engine.submitAnswer(true);
      expect(nextNode?.id).toBe('confirmed');
    });

    it('should handle != operator', () => {
      const schema: SurveyNode[] = [
        {
          id: 'name',
          prompt: 'What is your name?',
          expectedInput: 'text',
          paths: [
            { condition: 'answer != "skip"', nextId: 'greeting' },
            { condition: 'answer == "skip"', nextId: 'end' },
          ],
        },
        {
          id: 'greeting',
          prompt: 'Hello!',
          expectedInput: 'boolean',
          paths: [],
        },
        {
          id: 'end',
          prompt: 'Goodbye',
          expectedInput: 'boolean',
          paths: [],
        },
      ];
      
      const engine = new SurveyEngine(schema);
      engine.start();
      
      const nextNode = engine.submitAnswer('John');
      expect(nextNode?.id).toBe('greeting');
    });
  });

  describe('edge cases', () => {
    it('should handle empty paths array', () => {
      const schema: SurveyNode[] = [
        {
          id: 'only',
          prompt: 'Only question',
          expectedInput: 'boolean',
          paths: [],
        },
      ];
      
      const engine = new SurveyEngine(schema);
      engine.start();
      
      const result = engine.submitAnswer(true);
      expect(result).toBeNull();
      expect(engine.getState().isComplete).toBe(true);
    });

    it('should handle true condition string', () => {
      const schema: SurveyNode[] = [
        {
          id: 'start',
          prompt: 'Start',
          expectedInput: 'boolean',
          paths: [
            { condition: 'true', nextId: 'next' },
          ],
        },
        {
          id: 'next',
          prompt: 'Next',
          expectedInput: 'boolean',
          paths: [],
        },
      ];
      
      const engine = new SurveyEngine(schema);
      engine.start();
      
      const nextNode = engine.submitAnswer(false);
      expect(nextNode?.id).toBe('next');
    });

    it('should handle false condition string', () => {
      const schema: SurveyNode[] = [
        {
          id: 'start',
          prompt: 'Start',
          expectedInput: 'boolean',
          paths: [
            { condition: 'false', nextId: 'never' },
            { condition: 'default', nextId: 'always' },
          ],
        },
        {
          id: 'never',
          prompt: 'Never',
          expectedInput: 'boolean',
          paths: [],
        },
        {
          id: 'always',
          prompt: 'Always',
          expectedInput: 'boolean',
          paths: [],
        },
      ];
      
      const engine = new SurveyEngine(schema);
      engine.start();
      
      const nextNode = engine.submitAnswer(true);
      expect(nextNode?.id).toBe('always');
    });
  });
});
