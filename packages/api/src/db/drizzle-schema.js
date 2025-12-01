"use strict";
/**
 * Drizzle ORM Schema for Hail-Mary Quote Tool
 *
 * PostgreSQL database schema using Drizzle ORM.
 * Core entities: accounts, users, customers, leads, products, quotes, quote_lines,
 * visit_sessions, media_attachments, survey_templates, survey_instances, survey_answers, visit_observations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.visitObservations = exports.surveyAnswers = exports.surveyInstances = exports.surveyTemplates = exports.mediaAttachments = exports.visitSessions = exports.quoteLines = exports.quotes = exports.products = exports.leads = exports.customers = exports.users = exports.accounts = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
// Accounts / tenancies (optional but useful)
exports.accounts = (0, pg_core_1.pgTable)("accounts", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
// Users (people using the system)
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    accountId: (0, pg_core_1.integer)("account_id")
        .references(() => exports.accounts.id)
        .notNull(),
    email: (0, pg_core_1.varchar)("email", { length: 255 }).notNull().unique(),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    role: (0, pg_core_1.varchar)("role", { length: 50 }).default("user").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
// Customers (households / people you quote for)
exports.customers = (0, pg_core_1.pgTable)("customers", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    accountId: (0, pg_core_1.integer)("account_id")
        .references(() => exports.accounts.id)
        .notNull(),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    email: (0, pg_core_1.varchar)("email", { length: 255 }),
    phone: (0, pg_core_1.varchar)("phone", { length: 50 }),
    addressLine1: (0, pg_core_1.varchar)("address_line_1", { length: 255 }),
    addressLine2: (0, pg_core_1.varchar)("address_line_2", { length: 255 }),
    town: (0, pg_core_1.varchar)("town", { length: 255 }),
    postcode: (0, pg_core_1.varchar)("postcode", { length: 20 }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
// Leads (raw inbound interest)
exports.leads = (0, pg_core_1.pgTable)("leads", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    accountId: (0, pg_core_1.integer)("account_id")
        .references(() => exports.accounts.id)
        .notNull(),
    customerId: (0, pg_core_1.integer)("customer_id").references(() => exports.customers.id),
    source: (0, pg_core_1.varchar)("source", { length: 100 }), // e.g. "web", "phone", "referral"
    status: (0, pg_core_1.varchar)("status", { length: 50 }).default("new").notNull(), // new, contacted, qualified, closed
    notes: (0, pg_core_1.text)("notes"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
// Products (boilers, cylinders, filters, controls, etc.)
exports.products = (0, pg_core_1.pgTable)("products", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    accountId: (0, pg_core_1.integer)("account_id")
        .references(() => exports.accounts.id)
        .notNull(),
    sku: (0, pg_core_1.varchar)("sku", { length: 100 }).notNull(),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    description: (0, pg_core_1.text)("description"),
    basePrice: (0, pg_core_1.numeric)("base_price", { precision: 10, scale: 2 }).notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
// Quotes (header)
exports.quotes = (0, pg_core_1.pgTable)("quotes", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    accountId: (0, pg_core_1.integer)("account_id")
        .references(() => exports.accounts.id)
        .notNull(),
    customerId: (0, pg_core_1.integer)("customer_id")
        .references(() => exports.customers.id)
        .notNull(),
    leadId: (0, pg_core_1.integer)("lead_id").references(() => exports.leads.id),
    status: (0, pg_core_1.varchar)("status", { length: 50 }).default("draft").notNull(), // draft, sent, accepted, rejected, expired
    title: (0, pg_core_1.varchar)("title", { length: 255 }),
    validUntil: (0, pg_core_1.timestamp)("valid_until", { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
// Quote lines (line items)
exports.quoteLines = (0, pg_core_1.pgTable)("quote_lines", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    quoteId: (0, pg_core_1.integer)("quote_id")
        .references(() => exports.quotes.id)
        .notNull(),
    productId: (0, pg_core_1.integer)("product_id").references(() => exports.products.id),
    description: (0, pg_core_1.text)("description").notNull(),
    quantity: (0, pg_core_1.integer)("quantity").notNull().default(1),
    unitPrice: (0, pg_core_1.numeric)("unit_price", { precision: 10, scale: 2 }).notNull(),
    discount: (0, pg_core_1.numeric)("discount", { precision: 10, scale: 2 })
        .notNull()
        .default("0"),
    lineTotal: (0, pg_core_1.numeric)("line_total", { precision: 10, scale: 2 }).notNull(),
});
// ============================================
// Visit & Survey Tables (for voice-first workflow)
// ============================================
// Visit sessions - tracks a single site visit for a customer
exports.visitSessions = (0, pg_core_1.pgTable)("visit_sessions", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    accountId: (0, pg_core_1.integer)("account_id")
        .references(() => exports.accounts.id)
        .notNull(),
    customerId: (0, pg_core_1.integer)("customer_id")
        .references(() => exports.customers.id)
        .notNull(),
    startedAt: (0, pg_core_1.timestamp)("started_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    endedAt: (0, pg_core_1.timestamp)("ended_at", { withTimezone: true }),
    status: (0, pg_core_1.varchar)("status", { length: 50 }).default("in_progress").notNull(), // in_progress, completed, cancelled
});
// Media attachments - photos, videos, measurement screenshots
exports.mediaAttachments = (0, pg_core_1.pgTable)("media_attachments", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    visitSessionId: (0, pg_core_1.integer)("visit_session_id")
        .references(() => exports.visitSessions.id)
        .notNull(),
    customerId: (0, pg_core_1.integer)("customer_id")
        .references(() => exports.customers.id)
        .notNull(),
    type: (0, pg_core_1.varchar)("type", { length: 50 }).notNull(), // photo, video, measurement, other
    url: (0, pg_core_1.text)("url").notNull(),
    description: (0, pg_core_1.text)("description"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
// Survey templates - user-designed survey structures
exports.surveyTemplates = (0, pg_core_1.pgTable)("survey_templates", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    accountId: (0, pg_core_1.integer)("account_id")
        .references(() => exports.accounts.id)
        .notNull(),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    description: (0, pg_core_1.text)("description"),
    schema: (0, pg_core_1.jsonb)("schema").notNull(), // holds sections and questions
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
// Survey instances - a specific survey for a specific visit
exports.surveyInstances = (0, pg_core_1.pgTable)("survey_instances", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    templateId: (0, pg_core_1.integer)("template_id")
        .references(() => exports.surveyTemplates.id)
        .notNull(),
    visitSessionId: (0, pg_core_1.integer)("visit_session_id")
        .references(() => exports.visitSessions.id)
        .notNull(),
    customerId: (0, pg_core_1.integer)("customer_id")
        .references(() => exports.customers.id)
        .notNull(),
    status: (0, pg_core_1.varchar)("status", { length: 50 }).default("in_progress").notNull(), // in_progress, complete
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
// Survey answers - individual answers to survey questions
exports.surveyAnswers = (0, pg_core_1.pgTable)("survey_answers", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    instanceId: (0, pg_core_1.integer)("instance_id")
        .references(() => exports.surveyInstances.id)
        .notNull(),
    questionId: (0, pg_core_1.varchar)("question_id", { length: 255 }).notNull(), // matches question id from template.schema
    value: (0, pg_core_1.jsonb)("value"), // actual answer (string/number/bool/array)
    source: (0, pg_core_1.varchar)("source", { length: 50 }).notNull(), // voice, manual, ai
    rawText: (0, pg_core_1.text)("raw_text"), // original phrasing from transcript
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
// Visit observations - raw observations from STT during a visit
exports.visitObservations = (0, pg_core_1.pgTable)("visit_observations", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    visitSessionId: (0, pg_core_1.integer)("visit_session_id")
        .references(() => exports.visitSessions.id)
        .notNull(),
    customerId: (0, pg_core_1.integer)("customer_id")
        .references(() => exports.customers.id)
        .notNull(),
    text: (0, pg_core_1.text)("text").notNull(), // raw observation from STT
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHJpenpsZS1zY2hlbWEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkcml6emxlLXNjaGVtYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCxpREFVNkI7QUFFN0IsNkNBQTZDO0FBQ2hDLFFBQUEsUUFBUSxHQUFHLElBQUEsaUJBQU8sRUFBQyxVQUFVLEVBQUU7SUFDMUMsRUFBRSxFQUFFLElBQUEsZ0JBQU0sRUFBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLEVBQUU7SUFDN0IsSUFBSSxFQUFFLElBQUEsaUJBQU8sRUFBQyxNQUFNLEVBQUUsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUU7SUFDaEQsU0FBUyxFQUFFLElBQUEsbUJBQVMsRUFBQyxZQUFZLEVBQUUsRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFFLENBQUM7U0FDdkQsVUFBVSxFQUFFO1NBQ1osT0FBTyxFQUFFO0NBQ2IsQ0FBQyxDQUFDO0FBRUgsa0NBQWtDO0FBQ3JCLFFBQUEsS0FBSyxHQUFHLElBQUEsaUJBQU8sRUFBQyxPQUFPLEVBQUU7SUFDcEMsRUFBRSxFQUFFLElBQUEsZ0JBQU0sRUFBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLEVBQUU7SUFDN0IsU0FBUyxFQUFFLElBQUEsaUJBQU8sRUFBQyxZQUFZLENBQUM7U0FDN0IsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLGdCQUFRLENBQUMsRUFBRSxDQUFDO1NBQzdCLE9BQU8sRUFBRTtJQUNaLEtBQUssRUFBRSxJQUFBLGlCQUFPLEVBQUMsT0FBTyxFQUFFLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsTUFBTSxFQUFFO0lBQzNELElBQUksRUFBRSxJQUFBLGlCQUFPLEVBQUMsTUFBTSxFQUFFLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFO0lBQ2hELElBQUksRUFBRSxJQUFBLGlC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IjpbIi8qKlxuICogRHJpenpsZSBPUk0gU2NoZW1hIGZvciBIYWlsLU1hcnkgUXVvdGUgVG9vbFxuICpcbiAqIFBvc3RncmVTUUwgZGF0YWJhc2Ugc2NoZW1hIHVzaW5nIERyaXp6bGUgT1JNLlxuICogQ29yZSBlbnRpdGllczogYWNjb3VudHMsIHVzZXJzLCBjdXN0b21lcnMsIGxlYWRzLCBwcm9kdWN0cywgcXVvdGVzLCBxdW90ZV9saW5lcyxcbiAqIHZpc2l0X3Nlc3Npb25zLCBtZWRpYV9hdHRhY2htZW50cywgc3VydmV5X3RlbXBsYXRlcywgc3VydmV5X2luc3RhbmNlcywgc3VydmV5X2Fuc3dlcnMsIHZpc2l0X29ic2VydmF0aW9uc1xuICovXG5cbmltcG9ydCB7XG4gIHBnVGFibGUsXG4gIHNlcmlhbCxcbiAgdGV4dCxcbiAgdmFyY2hhcixcbiAgaW50ZWdlcixcbiAgdGltZXN0YW1wLFxuICBudW1lcmljLFxuICBib29sZWFuLFxuICBqc29uYixcbn0gZnJvbSBcImRyaXp6bGUtb3JtL3BnLWNvcmVcIjtcblxuLy8gQWNjb3VudHMgLyB0ZW5hbmNpZXMgKG9wdGlvbmFsIGJ1dCB1c2VmdWwpXG5leHBvcnQgY29uc3QgYWNjb3VudHMgPSBwZ1RhYmxlKFwiYWNjb3VudHNcIiwge1xuICBpZDogc2VyaWFsKFwiaWRcIikucHJpbWFyeUtleSgpLFxuICBuYW1lOiB2YXJjaGFyKFwibmFtZVwiLCB7IGxlbmd0aDogMjU1IH0pLm5vdE51bGwoKSxcbiAgY3JlYXRlZEF0OiB0aW1lc3RhbXAoXCJjcmVhdGVkX2F0XCIsIHsgd2l0aFRpbWV6b25lOiB0cnVlIH0pXG4gICAgLmRlZmF1bHROb3coKVxuICAgIC5ub3ROdWxsKCksXG59KTtcblxuLy8gVXNlcnMgKHBlb3BsZSB1c2luZyB0aGUgc3lzdGVtKVxuZXhwb3J0IGNvbnN0IHVzZXJzID0gcGdUYWJsZShcInVzZXJzXCIsIHtcbiAgaWQ6IHNlcmlhbChcImlkXCIpLnByaW1hcnlLZXkoKSxcbiAgYWNjb3VudElkOiBpbnRlZ2VyKFwiYWNjb3VudF9pZFwiKVxuICAgIC5yZWZlcmVuY2VzKCgpID0+IGFjY291bnRzLmlkKVxuICAgIC5ub3ROdWxsKCksXG4gIGVtYWlsOiB2YXJjaGFyKFwiZW1haWxcIiwgeyBsZW5ndGg6IDI1NSB9KS5ub3ROdWxsKCkudW5pcXVlKCksXG4gIG5hbWU6IHZhcmNoYXIoXCJuYW1lXCIsIHsgbGVuZ3RoOiAyNTUgfSkubm90TnVsbCgpLFxuICByb2xlOiB2YXJjaGFyKFwicm9sZVwiLCB7IGxlbmd0aDogNTAgfSkuZGVmYXVsdChcInVzZXJcIikubm90TnVsbCgpLFxuICBjcmVhdGVkQXQ6IHRpbWVzdGFtcChcImNyZWF0ZWRfYXRcIiwgeyB3aXRoVGltZXpvbmU6IHRydWUgfSlcbiAgICAuZGVmYXVsdE5vdygpXG4gICAgLm5vdE51bGwoKSxcbn0pO1xuXG4vLyBDdXN0b21lcnMgKGhvdXNlaG9sZHMgLyBwZW9wbGUgeW91IHF1b3RlIGZvcilcbmV4cG9ydCBjb25zdCBjdXN0b21lcnMgPSBwZ1RhYmxlKFwiY3VzdG9tZXJzXCIsIHtcbiAgaWQ6IHNlcmlhbChcImlkXCIpLnByaW1hcnlLZXkoKSxcbiAgYWNjb3VudElkOiBpbnRlZ2VyKFwiYWNjb3VudF9pZFwiKVxuICAgIC5yZWZlcmVuY2VzKCgpID0+IGFjY291bnRzLmlkKVxuICAgIC5ub3ROdWxsKCksXG4gIG5hbWU6IHZhcmNoYXIoXCJuYW1lXCIsIHsgbGVuZ3RoOiAyNTUgfSkubm90TnVsbCgpLFxuICBlbWFpbDogdmFyY2hhcihcImVtYWlsXCIsIHsgbGVuZ3RoOiAyNTUgfSksXG4gIHBob25lOiB2YXJjaGFyKFwicGhvbmVcIiwgeyBsZW5ndGg6IDUwIH0pLFxuICBhZGRyZXNzTGluZTE6IHZhcmNoYXIoXCJhZGRyZXNzX2xpbmVfMVwiLCB7IGxlbmd0aDogMjU1IH0pLFxuICBhZGRyZXNzTGluZTI6IHZhcmNoYXIoXCJhZGRyZXNzX2xpbmVfMlwiLCB7IGxlbmd0aDogMjU1IH0pLFxuICB0b3duOiB2YXJjaGFyKFwidG93blwiLCB7IGxlbmd0aDogMjU1IH0pLFxuICBwb3N0Y29kZTogdmFyY2hhcihcInBvc3Rjb2RlXCIsIHsgbGVuZ3RoOiAyMCB9KSxcbiAgY3JlYXRlZEF0OiB0aW1lc3RhbXAoXCJjcmVhdGVkX2F0XCIsIHsgd2l0aFRpbWV6b25lOiB0cnVlIH0pXG4gICAgLmRlZmF1bHROb3coKVxuICAgIC5ub3ROdWxsKCksXG59KTtcblxuLy8gTGVhZHMgKHJhdyBpbmJvdW5kIGludGVyZXN0KVxuZXhwb3J0IGNvbnN0IGxlYWRzID0gcGdUYWJsZShcImxlYWRzXCIsIHtcbiAgaWQ6IHNlcmlhbChcImlkXCIpLnByaW1hcnlLZXkoKSxcbiAgYWNjb3VudElkOiBpbnRlZ2VyKFwiYWNjb3VudF9pZFwiKVxuICAgIC5yZWZlcmVuY2VzKCgpID0+IGFjY291bnRzLmlkKVxuICAgIC5ub3ROdWxsKCksXG4gIGN1c3RvbWVySWQ6IGludGVnZXIoXCJjdXN0b21lcl9pZFwiKS5yZWZlcmVuY2VzKCgpID0+IGN1c3RvbWVycy5pZCksXG4gIHNvdXJjZTogdmFyY2hhcihcInNvdXJjZVwiLCB7IGxlbmd0aDogMTAwIH0pLCAvLyBlLmcuIFwid2ViXCIsIFwicGhvbmVcIiwgXCJyZWZlcnJhbFwiXG4gIHN0YXR1czogdmFyY2hhcihcInN0YXR1c1wiLCB7IGxlbmd0aDogNTAgfSkuZGVmYXVsdChcIm5ld1wiKS5ub3ROdWxsKCksIC8vIG5ldywgY29udGFjdGVkLCBxdWFsaWZpZWQsIGNsb3NlZFxuICBub3RlczogdGV4dChcIm5vdGVzXCIpLFxuICBjcmVhdGVkQXQ6IHRpbWVzdGFtcChcImNyZWF0ZWRfYXRcIiwgeyB3aXRoVGltZXpvbmU6IHRydWUgfSlcbiAgICAuZGVmYXVsdE5vdygpXG4gICAgLm5vdE51bGwoKSxcbn0pO1xuXG4vLyBQcm9kdWN0cyAoYm9pbGVycywgY3lsaW5kZXJzLCBmaWx0ZXJzLCBjb250cm9scywgZXRjLilcbmV4cG9ydCBjb25zdCBwcm9kdWN0cyA9IHBnVGFibGUoXCJwcm9kdWN0c1wiLCB7XG4gIGlkOiBzZXJpYWwoXCJpZFwiKS5wcmltYXJ5S2V5KCksXG4gIGFjY291bnRJZDogaW50ZWdlcihcImFjY291bnRfaWRcIilcbiAgICAucmVmZXJlbmNlcygoKSA9PiBhY2NvdW50cy5pZClcbiAgICAubm90TnVsbCgpLFxuICBza3U6IHZhcmNoYXIoXCJza3VcIiwgeyBsZW5ndGg6IDEwMCB9KS5ub3ROdWxsKCksXG4gIG5hbWU6IHZhcmNoYXIoXCJuYW1lXCIsIHsgbGVuZ3RoOiAyNTUgfSkubm90TnVsbCgpLFxuICBkZXNjcmlwdGlvbjogdGV4dChcImRlc2NyaXB0aW9uXCIpLFxuICBiYXNlUHJpY2U6IG51bWVyaWMoXCJiYXNlX3ByaWNlXCIsIHsgcHJlY2lzaW9uOiAxMCwgc2NhbGU6IDIgfSkubm90TnVsbCgpLFxuICBpc0FjdGl2ZTogYm9vbGVhbihcImlzX2FjdGl2ZVwiKS5kZWZhdWx0KHRydWUpLm5vdE51bGwoKSxcbiAgY3JlYXRlZEF0OiB0aW1lc3RhbXAoXCJjcmVhdGVkX2F0XCIsIHsgd2l0aFRpbWV6b25lOiB0cnVlIH0pXG4gICAgLmRlZmF1bHROb3coKVxuICAgIC5ub3ROdWxsKCksXG59KTtcblxuLy8gUXVvdGVzIChoZWFkZXIpXG5leHBvcnQgY29uc3QgcXVvdGVzID0gcGdUYWJsZShcInF1b3Rlc1wiLCB7XG4gIGlkOiBzZXJpYWwoXCJpZFwiKS5wcmltYXJ5S2V5KCksXG4gIGFjY291bnRJZDogaW50ZWdlcihcImFjY291bnRfaWRcIilcbiAgICAucmVmZXJlbmNlcygoKSA9PiBhY2NvdW50cy5pZClcbiAgICAubm90TnVsbCgpLFxuICBjdXN0b21lcklkOiBpbnRlZ2VyKFwiY3VzdG9tZXJfaWRcIilcbiAgICAucmVmZXJlbmNlcygoKSA9PiBjdXN0b21lcnMuaWQpXG4gICAgLm5vdE51bGwoKSxcbiAgbGVhZElkOiBpbnRlZ2VyKFwibGVhZF9pZFwiKS5yZWZlcmVuY2VzKCgpID0+IGxlYWRzLmlkKSxcbiAgc3RhdHVzOiB2YXJjaGFyKFwic3RhdHVzXCIsIHsgbGVuZ3RoOiA1MCB9KS5kZWZhdWx0KFwiZHJhZnRcIikubm90TnVsbCgpLCAvLyBkcmFmdCwgc2VudCwgYWNjZXB0ZWQsIHJlamVjdGVkLCBleHBpcmVkXG4gIHRpdGxlOiB2YXJjaGFyKFwidGl0bGVcIiwgeyBsZW5ndGg6IDI1NSB9KSxcbiAgdmFsaWRVbnRpbDogdGltZXN0YW1wKFwidmFsaWRfdW50aWxcIiwgeyB3aXRoVGltZXpvbmU6IHRydWUgfSksXG4gIGNyZWF0ZWRBdDogdGltZXN0YW1wKFwiY3JlYXRlZF9hdFwiLCB7IHdpdGhUaW1lem9uZTogdHJ1ZSB9KVxuICAgIC5kZWZhdWx0Tm93KClcbiAgICAubm90TnVsbCgpLFxufSk7XG5cbi8vIFF1b3RlIGxpbmVzIChsaW5lIGl0ZW1zKVxuZXhwb3J0IGNvbnN0IHF1b3RlTGluZXMgPSBwZ1RhYmxlKFwicXVvdGVfbGluZXNcIiwge1xuICBpZDogc2VyaWFsKFwiaWRcIikucHJpbWFyeUtleSgpLFxuICBxdW90ZUlkOiBpbnRlZ2VyKFwicXVvdGVfaWRcIilcbiAgICAucmVmZXJlbmNlcygoKSA9PiBxdW90ZXMuaWQpXG4gICAgLm5vdE51bGwoKSxcbiAgcHJvZHVjdElkOiBpbnRlZ2VyKFwicHJvZHVjdF9pZFwiKS5yZWZlcmVuY2VzKCgpID0+IHByb2R1Y3RzLmlkKSxcbiAgZGVzY3JpcHRpb246IHRleHQoXCJkZXNjcmlwdGlvblwiKS5ub3ROdWxsKCksXG4gIHF1YW50aXR5OiBpbnRlZ2VyKFwicXVhbnRpdHlcIikubm90TnVsbCgpLmRlZmF1bHQoMSksXG4gIHVuaXRQcmljZTogbnVtZXJpYyhcInVuaXRfcHJpY2VcIiwgeyBwcmVjaXNpb246IDEwLCBzY2FsZTogMiB9KS5ub3ROdWxsKCksXG4gIGRpc2NvdW50OiBudW1lcmljKFwiZGlzY291bnRcIiwgeyBwcmVjaXNpb246IDEwLCBzY2FsZTogMiB9KVxuICAgIC5ub3ROdWxsKClcbiAgICAuZGVmYXVsdChcIjBcIiksXG4gIGxpbmVUb3RhbDogbnVtZXJpYyhcImxpbmVfdG90YWxcIiwgeyBwcmVjaXNpb246IDEwLCBzY2FsZTogMiB9KS5ub3ROdWxsKCksXG59KTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFZpc2l0ICYgU3VydmV5IFRhYmxlcyAoZm9yIHZvaWNlLWZpcnN0IHdvcmtmbG93KVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gVmlzaXQgc2Vzc2lvbnMgLSB0cmFja3MgYSBzaW5nbGUgc2l0ZSB2aXNpdCBmb3IgYSBjdXN0b21lclxuZXhwb3J0IGNvbnN0IHZpc2l0U2Vzc2lvbnMgPSBwZ1RhYmxlKFwidmlzaXRfc2Vzc2lvbnNcIiwge1xuICBpZDogc2VyaWFsKFwiaWRcIikucHJpbWFyeUtleSgpLFxuICBhY2NvdW50SWQ6IGludGVnZXIoXCJhY2NvdW50X2lkXCIpXG4gICAgLnJlZmVyZW5jZXMoKCkgPT4gYWNjb3VudHMuaWQpXG4gICAgLm5vdE51bGwoKSxcbiAgY3VzdG9tZXJJZDogaW50ZWdlcihcImN1c3RvbWVyX2lkXCIpXG4gICAgLnJlZmVyZW5jZXMoKCkgPT4gY3VzdG9tZXJzLmlkKVxuICAgIC5ub3ROdWxsKCksXG4gIHN0YXJ0ZWRBdDogdGltZXN0YW1wKFwic3RhcnRlZF9hdFwiLCB7IHdpdGhUaW1lem9uZTogdHJ1ZSB9KVxuICAgIC5kZWZhdWx0Tm93KClcbiAgICAubm90TnVsbCgpLFxuICBlbmRlZEF0OiB0aW1lc3RhbXAoXCJlbmRlZF9hdFwiLCB7IHdpdGhUaW1lem9uZTogdHJ1ZSB9KSxcbiAgc3RhdHVzOiB2YXJjaGFyKFwic3RhdHVzXCIsIHsgbGVuZ3RoOiA1MCB9KS5kZWZhdWx0KFwiaW5fcHJvZ3Jlc3NcIikubm90TnVsbCgpLCAvLyBpbl9wcm9ncmVzcywgY29tcGxldGVkLCBjYW5jZWxsZWRcbn0pO1xuXG4vLyBNZWRpYSBhdHRhY2htZW50cyAtIHBob3RvcywgdmlkZW9zLCBtZWFzdXJlbWVudCBzY3JlZW5zaG90c1xuZXhwb3J0IGNvbnN0IG1lZGlhQXR0YWNobWVudHMgPSBwZ1RhYmxlKFwibWVkaWFfYXR0YWNobWVudHNcIiwge1xuICBpZDogc2VyaWFsKFwiaWRcIikucHJpbWFyeUtleSgpLFxuICB2aXNpdFNlc3Npb25JZDogaW50ZWdlcihcInZpc2l0X3Nlc3Npb25faWRcIilcbiAgICAucmVmZXJlbmNlcygoKSA9PiB2aXNpdFNlc3Npb25zLmlkKVxuICAgIC5ub3ROdWxsKCksXG4gIGN1c3RvbWVySWQ6IGludGVnZXIoXCJjdXN0b21lcl9pZFwiKVxuICAgIC5yZWZlcmVuY2VzKCgpID0+IGN1c3RvbWVycy5pZClcbiAgICAubm90TnVsbCgpLFxuICB0eXBlOiB2YXJjaGFyKFwidHlwZVwiLCB7IGxlbmd0aDogNTAgfSkubm90TnVsbCgpLCAvLyBwaG90bywgdmlkZW8sIG1lYXN1cmVtZW50LCBvdGhlclxuICB1cmw6IHRleHQoXCJ1cmxcIikubm90TnVsbCgpLFxuICBkZXNjcmlwdGlvbjogdGV4dChcImRlc2NyaXB0aW9uXCIpLFxuICBjcmVhdGVkQXQ6IHRpbWVzdGFtcChcImNyZWF0ZWRfYXRcIiwgeyB3aXRoVGltZXpvbmU6IHRydWUgfSlcbiAgICAuZGVmYXVsdE5vdygpXG4gICAgLm5vdE51bGwoKSxcbn0pO1xuXG4vLyBTdXJ2ZXkgdGVtcGxhdGVzIC0gdXNlci1kZXNpZ25lZCBzdXJ2ZXkgc3RydWN0dXJlc1xuZXhwb3J0IGNvbnN0IHN1cnZleVRlbXBsYXRlcyA9IHBnVGFibGUoXCJzdXJ2ZXlfdGVtcGxhdGVzXCIsIHtcbiAgaWQ6IHNlcmlhbChcImlkXCIpLnByaW1hcnlLZXkoKSxcbiAgYWNjb3VudElkOiBpbnRlZ2VyKFwiYWNjb3VudF9pZFwiKVxuICAgIC5yZWZlcmVuY2VzKCgpID0+IGFjY291bnRzLmlkKVxuICAgIC5ub3ROdWxsKCksXG4gIG5hbWU6IHZhcmNoYXIoXCJuYW1lXCIsIHsgbGVuZ3RoOiAyNTUgfSkubm90TnVsbCgpLFxuICBkZXNjcmlwdGlvbjogdGV4dChcImRlc2NyaXB0aW9uXCIpLFxuICBzY2hlbWE6IGpzb25iKFwic2NoZW1hXCIpLm5vdE51bGwoKSwgLy8gaG9sZHMgc2VjdGlvbnMgYW5kIHF1ZXN0aW9uc1xuICBjcmVhdGVkQXQ6IHRpbWVzdGFtcChcImNyZWF0ZWRfYXRcIiwgeyB3aXRoVGltZXpvbmU6IHRydWUgfSlcbiAgICAuZGVmYXVsdE5vdygpXG4gICAgLm5vdE51bGwoKSxcbiAgdXBkYXRlZEF0OiB0aW1lc3RhbXAoXCJ1cGRhdGVkX2F0XCIsIHsgd2l0aFRpbWV6b25lOiB0cnVlIH0pXG4gICAgLmRlZmF1bHROb3coKVxuICAgIC5ub3ROdWxsKCksXG59KTtcblxuLy8gU3VydmV5IGluc3RhbmNlcyAtIGEgc3BlY2lmaWMgc3VydmV5IGZvciBhIHNwZWNpZmljIHZpc2l0XG5leHBvcnQgY29uc3Qgc3VydmV5SW5zdGFuY2VzID0gcGdUYWJsZShcInN1cnZleV9pbnN0YW5jZXNcIiwge1xuICBpZDogc2VyaWFsKFwiaWRcIikucHJpbWFyeUtleSgpLFxuICB0ZW1wbGF0ZUlkOiBpbnRlZ2VyKFwidGVtcGxhdGVfaWRcIilcbiAgICAucmVmZXJlbmNlcygoKSA9PiBzdXJ2ZXlUZW1wbGF0ZXMuaWQpXG4gICAgLm5vdE51bGwoKSxcbiAgdmlzaXRTZXNzaW9uSWQ6IGludGVnZXIoXCJ2aXNpdF9zZXNzaW9uX2lkXCIpXG4gICAgLnJlZmVyZW5jZXMoKCkgPT4gdmlzaXRTZXNzaW9ucy5pZClcbiAgICAubm90TnVsbCgpLFxuICBjdXN0b21lcklkOiBpbnRlZ2VyKFwiY3VzdG9tZXJfaWRcIilcbiAgICAucmVmZXJlbmNlcygoKSA9PiBjdXN0b21lcnMuaWQpXG4gICAgLm5vdE51bGwoKSxcbiAgc3RhdHVzOiB2YXJjaGFyKFwic3RhdHVzXCIsIHsgbGVuZ3RoOiA1MCB9KS5kZWZhdWx0KFwiaW5fcHJvZ3Jlc3NcIikubm90TnVsbCgpLCAvLyBpbl9wcm9ncmVzcywgY29tcGxldGVcbiAgY3JlYXRlZEF0OiB0aW1lc3RhbXAoXCJjcmVhdGVkX2F0XCIsIHsgd2l0aFRpbWV6b25lOiB0cnVlIH0pXG4gICAgLmRlZmF1bHROb3coKVxuICAgIC5ub3ROdWxsKCksXG4gIHVwZGF0ZWRBdDogdGltZXN0YW1wKFwidXBkYXRlZF9hdFwiLCB7IHdpdGhUaW1lem9uZTogdHJ1ZSB9KVxuICAgIC5kZWZhdWx0Tm93KClcbiAgICAubm90TnVsbCgpLFxufSk7XG5cbi8vIFN1cnZleSBhbnN3ZXJzIC0gaW5kaXZpZHVhbCBhbnN3ZXJzIHRvIHN1cnZleSBxdWVzdGlvbnNcbmV4cG9ydCBjb25zdCBzdXJ2ZXlBbnN3ZXJzID0gcGdUYWJsZShcInN1cnZleV9hbnN3ZXJzXCIsIHtcbiAgaWQ6IHNlcmlhbChcImlkXCIpLnByaW1hcnlLZXkoKSxcbiAgaW5zdGFuY2VJZDogaW50ZWdlcihcImluc3RhbmNlX2lkXCIpXG4gICAgLnJlZmVyZW5jZXMoKCkgPT4gc3VydmV5SW5zdGFuY2VzLmlkKVxuICAgIC5ub3ROdWxsKCksXG4gIHF1ZXN0aW9uSWQ6IHZhcmNoYXIoXCJxdWVzdGlvbl9pZFwiLCB7IGxlbmd0aDogMjU1IH0pLm5vdE51bGwoKSwgLy8gbWF0Y2hlcyBxdWVzdGlvbiBpZCBmcm9tIHRlbXBsYXRlLnNjaGVtYVxuICB2YWx1ZToganNvbmIoXCJ2YWx1ZVwiKSwgLy8gYWN0dWFsIGFuc3dlciAoc3RyaW5nL251bWJlci9ib29sL2FycmF5KVxuICBzb3VyY2U6IHZhcmNoYXIoXCJzb3VyY2VcIiwgeyBsZW5ndGg6IDUwIH0pLm5vdE51bGwoKSwgLy8gdm9pY2UsIG1hbnVhbCwgYWlcbiAgcmF3VGV4dDogdGV4dChcInJhd190ZXh0XCIpLCAvLyBvcmlnaW5hbCBwaHJhc2luZyBmcm9tIHRyYW5zY3JpcHRcbiAgY3JlYXRlZEF0OiB0aW1lc3RhbXAoXCJjcmVhdGVkX2F0XCIsIHsgd2l0aFRpbWV6b25lOiB0cnVlIH0pXG4gICAgLmRlZmF1bHROb3coKVxuICAgIC5ub3ROdWxsKCksXG59KTtcblxuLy8gVmlzaXQgb2JzZXJ2YXRpb25zIC0gcmF3IG9ic2VydmF0aW9ucyBmcm9tIFNUVCBkdXJpbmcgYSB2aXNpdFxuZXhwb3J0IGNvbnN0IHZpc2l0T2JzZXJ2YXRpb25zID0gcGdUYWJsZShcInZpc2l0X29ic2VydmF0aW9uc1wiLCB7XG4gIGlkOiBzZXJpYWwoXCJpZFwiKS5wcmltYXJ5S2V5KCksXG4gIHZpc2l0U2Vzc2lvbklkOiBpbnRlZ2VyKFwidmlzaXRfc2Vzc2lvbl9pZFwiKVxuICAgIC5yZWZlcmVuY2VzKCgpID0+IHZpc2l0U2Vzc2lvbnMuaWQpXG4gICAgLm5vdE51bGwoKSxcbiAgY3VzdG9tZXJJZDogaW50ZWdlcihcImN1c3RvbWVyX2lkXCIpXG4gICAgLnJlZmVyZW5jZXMoKCkgPT4gY3VzdG9tZXJzLmlkKVxuICAgIC5ub3ROdWxsKCksXG4gIHRleHQ6IHRleHQoXCJ0ZXh0XCIpLm5vdE51bGwoKSwgLy8gcmF3IG9ic2VydmF0aW9uIGZyb20gU1RUXG4gIGNyZWF0ZWRBdDogdGltZXN0YW1wKFwiY3JlYXRlZF9hdFwiLCB7IHdpdGhUaW1lem9uZTogdHJ1ZSB9KVxuICAgIC5kZWZhdWx0Tm93KClcbiAgICAubm90TnVsbCgpLFxufSk7XG4iXX0=