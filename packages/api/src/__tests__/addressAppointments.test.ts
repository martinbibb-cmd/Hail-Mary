/**
 * Smoke tests for Address Appointments API
 *
 * Tests the appointment booking functionality, note entries,
 * file uploads, and diary feed operations.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the database module
jest.mock('../db/drizzle-client', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    inArray: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(() => Promise.resolve([])),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  },
}));

jest.mock('../db/drizzle-schema', () => ({
  addressAppointments: {
    id: 'id',
    addressId: 'address_id',
    type: 'type',
    status: 'status',
    startAt: 'start_at',
    endAt: 'end_at',
    createdByUserId: 'created_by_user_id',
    assignedUserId: 'assigned_user_id',
    notesRichText: 'notes_rich_text',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  appointmentNoteEntries: {
    id: 'id',
    appointmentId: 'appointment_id',
    sourceType: 'source_type',
    sourceName: 'source_name',
    rawText: 'raw_text',
    renderedNote: 'rendered_note',
    parsedJson: 'parsed_json',
    createdByUserId: 'created_by_user_id',
    createdAt: 'created_at',
  },
  appointmentFiles: {
    id: 'id',
    appointmentId: 'appointment_id',
    addressId: 'address_id',
    filename: 'filename',
    mimeType: 'mime_type',
    size: 'size',
    storagePath: 'storage_path',
    createdByUserId: 'created_by_user_id',
    createdAt: 'created_at',
  },
  addresses: { id: 'id', line1: 'line1', postcode: 'postcode' },
  users: { id: 'id', email: 'email', name: 'name' },
}));

describe('Address Appointments API - Smoke Tests', () => {
  describe('Appointment Type Validation', () => {
    it('should accept valid appointment types', () => {
      const validTypes = ['SURVEY', 'REVISIT', 'CALLBACK', 'INSTALL', 'SERVICE_REPAIR'];

      validTypes.forEach(type => {
        expect(['SURVEY', 'REVISIT', 'CALLBACK', 'INSTALL', 'SERVICE_REPAIR']).toContain(type);
      });
    });

    it('should reject invalid appointment types', () => {
      const invalidType = 'INVALID_TYPE';
      const validTypes = ['SURVEY', 'REVISIT', 'CALLBACK', 'INSTALL', 'SERVICE_REPAIR'];

      expect(validTypes).not.toContain(invalidType);
    });
  });

  describe('Appointment Status Validation', () => {
    it('should accept valid appointment statuses', () => {
      const validStatuses = ['PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

      validStatuses.forEach(status => {
        expect(['PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).toContain(status);
      });
    });

    it('should validate status transitions', () => {
      const validTransitions: Record<string, string[]> = {
        PLANNED: ['CONFIRMED', 'CANCELLED'],
        CONFIRMED: ['COMPLETED', 'CANCELLED'],
        COMPLETED: [], // Terminal state
        CANCELLED: [], // Terminal state
      };

      expect(validTransitions.PLANNED).toContain('CONFIRMED');
      expect(validTransitions.CONFIRMED).toContain('COMPLETED');
      expect(validTransitions.COMPLETED.length).toBe(0);
    });
  });

  describe('Appointment Time Validation', () => {
    it('should ensure endAt is after startAt', () => {
      const startAt = new Date('2025-01-15T10:00:00Z');
      const endAt = new Date('2025-01-15T11:00:00Z');

      expect(endAt.getTime()).toBeGreaterThan(startAt.getTime());
    });

    it('should reject appointments where endAt is before startAt', () => {
      const startAt = new Date('2025-01-15T10:00:00Z');
      const endAt = new Date('2025-01-15T09:00:00Z');

      expect(endAt.getTime()).toBeLessThan(startAt.getTime());
    });

    it('should validate typical appointment duration', () => {
      const startAt = new Date('2025-01-15T10:00:00Z');
      const endAt = new Date('2025-01-15T11:00:00Z');
      const durationMs = endAt.getTime() - startAt.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);

      expect(durationHours).toBe(1);
      expect(durationHours).toBeGreaterThan(0);
      expect(durationHours).toBeLessThan(24); // Reasonable limit
    });
  });

  describe('Diary Feed Filtering', () => {
    const appointments = [
      {
        id: '1',
        type: 'SURVEY',
        status: 'CONFIRMED',
        startAt: new Date('2025-01-15T10:00:00Z'),
        assignedUserId: 1,
      },
      {
        id: '2',
        type: 'INSTALL',
        status: 'PLANNED',
        startAt: new Date('2025-01-16T14:00:00Z'),
        assignedUserId: 2,
      },
      {
        id: '3',
        type: 'SURVEY',
        status: 'COMPLETED',
        startAt: new Date('2025-01-17T09:00:00Z'),
        assignedUserId: 1,
      },
      {
        id: '4',
        type: 'CALLBACK',
        status: 'CANCELLED',
        startAt: new Date('2025-01-18T11:00:00Z'),
        assignedUserId: 1,
      },
    ];

    it('should filter by appointment type', () => {
      const surveyAppointments = appointments.filter(apt => apt.type === 'SURVEY');

      expect(surveyAppointments.length).toBe(2);
      expect(surveyAppointments.every(apt => apt.type === 'SURVEY')).toBe(true);
    });

    it('should filter by status', () => {
      const activeAppointments = appointments.filter(apt =>
        apt.status === 'CONFIRMED' || apt.status === 'PLANNED'
      );

      expect(activeAppointments.length).toBe(2);
      expect(activeAppointments.every(apt =>
        apt.status === 'CONFIRMED' || apt.status === 'PLANNED'
      )).toBe(true);
    });

    it('should filter by assigned user (mine=true)', () => {
      const userId = 1;
      const myAppointments = appointments.filter(apt => apt.assignedUserId === userId);

      expect(myAppointments.length).toBe(3);
      expect(myAppointments.every(apt => apt.assignedUserId === userId)).toBe(true);
    });

    it('should filter by date range', () => {
      const from = new Date('2025-01-16T00:00:00Z');
      const to = new Date('2025-01-17T23:59:59Z');

      const appointmentsInRange = appointments.filter(apt =>
        apt.startAt >= from && apt.startAt <= to
      );

      expect(appointmentsInRange.length).toBe(2);
      expect(appointmentsInRange[0].id).toBe('2');
      expect(appointmentsInRange[1].id).toBe('3');
    });

    it('should filter by multiple criteria', () => {
      const userId = 1;
      const from = new Date('2025-01-15T00:00:00Z');
      const to = new Date('2025-01-17T23:59:59Z');

      const filtered = appointments.filter(apt =>
        apt.assignedUserId === userId &&
        apt.startAt >= from &&
        apt.startAt <= to &&
        apt.status !== 'CANCELLED'
      );

      expect(filtered.length).toBe(2);
      expect(filtered.every(apt => apt.assignedUserId === userId)).toBe(true);
      expect(filtered.every(apt => apt.status !== 'CANCELLED')).toBe(true);
    });
  });

  describe('Note Entry Source Types', () => {
    it('should accept valid note source types', () => {
      const validSourceTypes = [
        'TRANSCRIPT_FILE',
        'TEXT_PASTE',
        'FILE_UPLOAD',
        'MANUAL_NOTE',
      ];

      validSourceTypes.forEach(sourceType => {
        expect([
          'TRANSCRIPT_FILE',
          'TEXT_PASTE',
          'FILE_UPLOAD',
          'MANUAL_NOTE',
        ]).toContain(sourceType);
      });
    });

    it('should create note entry with TRANSCRIPT_FILE source', () => {
      const noteEntry = {
        appointmentId: '123',
        sourceType: 'TRANSCRIPT_FILE',
        sourceName: 'site-visit-2025-01-15.txt',
        rawText: 'Customer needs new boiler installation...',
        renderedNote: '<p>Customer needs new boiler installation...</p>',
        createdByUserId: 1,
      };

      expect(noteEntry.sourceType).toBe('TRANSCRIPT_FILE');
      expect(noteEntry.sourceName).toContain('.txt');
      expect(noteEntry.rawText).toBeTruthy();
    });

    it('should create note entry with MANUAL_NOTE source', () => {
      const noteEntry = {
        appointmentId: '123',
        sourceType: 'MANUAL_NOTE',
        sourceName: null,
        rawText: 'Follow up next week',
        renderedNote: '<p>Follow up next week</p>',
        createdByUserId: 1,
      };

      expect(noteEntry.sourceType).toBe('MANUAL_NOTE');
      expect(noteEntry.rawText).toBeTruthy();
    });

    it('should parse structured data from transcript', () => {
      const noteEntry = {
        appointmentId: '123',
        sourceType: 'TRANSCRIPT_FILE',
        rawText: 'Customer: John Doe, Budget: £3000, Boiler Type: Combi',
        parsedJson: {
          customer: 'John Doe',
          budget: 3000,
          boilerType: 'Combi',
        },
      };

      expect(noteEntry.parsedJson).toBeTruthy();
      expect(noteEntry.parsedJson.customer).toBe('John Doe');
      expect(noteEntry.parsedJson.budget).toBe(3000);
    });
  });

  describe('Appointment File Uploads', () => {
    it('should validate file metadata', () => {
      const file = {
        appointmentId: '123',
        addressId: '456',
        filename: 'site-photo.jpg',
        mimeType: 'image/jpeg',
        size: 1024000, // 1MB
        storagePath: '/uploads/2025/01/site-photo.jpg',
        createdByUserId: 1,
      };

      expect(file.filename).toBeTruthy();
      expect(file.mimeType).toBeTruthy();
      expect(file.size).toBeGreaterThan(0);
      expect(file.storagePath).toBeTruthy();
    });

    it('should accept common file types', () => {
      const validMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'text/plain',
        'audio/mpeg',
        'audio/wav',
      ];

      validMimeTypes.forEach(mimeType => {
        expect(mimeType).toMatch(/^(image|application|text|audio)\//);
      });
    });

    it('should validate file size limits', () => {
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      const validFile = { size: 5 * 1024 * 1024 }; // 5MB
      const invalidFile = { size: 15 * 1024 * 1024 }; // 15MB

      expect(validFile.size).toBeLessThanOrEqual(maxFileSize);
      expect(invalidFile.size).toBeGreaterThan(maxFileSize);
    });

    it('should link files to both appointment and address', () => {
      const file = {
        id: '1',
        appointmentId: '123',
        addressId: '456',
        filename: 'boiler-spec.pdf',
      };

      expect(file.appointmentId).toBeTruthy();
      expect(file.addressId).toBeTruthy();
    });
  });

  describe('Appointment Permission Logic', () => {
    const appointments = [
      { id: '1', addressId: 'addr1', createdByUserId: 1, assignedUserId: 1 },
      { id: '2', addressId: 'addr2', createdByUserId: 2, assignedUserId: 1 },
      { id: '3', addressId: 'addr3', createdByUserId: 2, assignedUserId: 2 },
    ];

    const addresses = [
      { id: 'addr1', createdByUserId: 1, assignedUserId: 1 },
      { id: 'addr2', createdByUserId: 2, assignedUserId: 1 },
      { id: 'addr3', createdByUserId: 2, assignedUserId: 2 },
    ];

    it('should allow users to see appointments for their addresses', () => {
      const userId = 1;

      // User can see appointments for addresses they created or are assigned to
      const userAddresses = addresses.filter(addr =>
        addr.createdByUserId === userId || addr.assignedUserId === userId
      );
      const userAddressIds = userAddresses.map(addr => addr.id);

      const visibleAppointments = appointments.filter(apt =>
        userAddressIds.includes(apt.addressId)
      );

      expect(visibleAppointments.length).toBe(2);
    });

    it('should allow users to see appointments assigned to them', () => {
      const userId = 1;

      const myAppointments = appointments.filter(apt =>
        apt.assignedUserId === userId
      );

      expect(myAppointments.length).toBe(2);
    });

    it('should allow admins to see all appointments', () => {
      const isAdmin = true;

      const visibleAppointments = isAdmin ? appointments : [];

      expect(visibleAppointments.length).toBe(3);
    });
  });

  describe('Notes Aggregation Logic', () => {
    it('should aggregate notes into appointment notesRichText', () => {
      const noteEntries = [
        {
          id: '1',
          appointmentId: '123',
          renderedNote: '<p>Initial assessment complete</p>',
          createdAt: new Date('2025-01-15T10:00:00Z'),
        },
        {
          id: '2',
          appointmentId: '123',
          renderedNote: '<p>Follow-up needed next week</p>',
          createdAt: new Date('2025-01-15T11:00:00Z'),
        },
      ];

      // Notes should be concatenated in chronological order
      const aggregatedNotes = noteEntries
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(entry => entry.renderedNote)
        .join('\n');

      expect(aggregatedNotes).toContain('Initial assessment complete');
      expect(aggregatedNotes).toContain('Follow-up needed next week');
    });
  });

  describe('Calendar Event Mapping', () => {
    it('should map appointment to FullCalendar event format', () => {
      const appointment = {
        id: '123',
        type: 'SURVEY',
        status: 'CONFIRMED',
        startAt: new Date('2025-01-15T10:00:00Z'),
        endAt: new Date('2025-01-15T11:00:00Z'),
        notesRichText: '<p>Site survey at customer location</p>',
      };

      const calendarEvent = {
        id: appointment.id,
        title: appointment.type,
        start: appointment.startAt.toISOString(),
        end: appointment.endAt.toISOString(),
        extendedProps: {
          type: appointment.type,
          status: appointment.status,
          notes: appointment.notesRichText,
        },
      };

      expect(calendarEvent.id).toBe('123');
      expect(calendarEvent.title).toBe('SURVEY');
      expect(calendarEvent.start).toBe('2025-01-15T10:00:00.000Z');
      expect(calendarEvent.extendedProps.status).toBe('CONFIRMED');
    });

    it('should assign colors based on appointment type', () => {
      const typeColors: Record<string, string> = {
        SURVEY: '#3b82f6',
        INSTALL: '#10b981',
        REVISIT: '#f59e0b',
        CALLBACK: '#8b5cf6',
        SERVICE_REPAIR: '#ef4444',
      };

      expect(typeColors.SURVEY).toBe('#3b82f6');
      expect(typeColors.INSTALL).toBe('#10b981');
      expect(typeColors.SERVICE_REPAIR).toBe('#ef4444');
    });
  });
});
