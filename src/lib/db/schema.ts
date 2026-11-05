import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { DesignDocument, DesignTheme } from "@/lib/builder";
import type { TranslatedContent } from "@/lib/translation";

export const visibility = pgEnum("visibility", [
  "public",
  "unlisted",
  "private",
]);
export const memberRole = pgEnum("member_role", [
  "owner",
  "admin",
  "editor",
  "reader",
]);
export const pageStatus = pgEnum("page_status", ["draft", "published"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const resourceQuotas = pgTable("resource_quotas", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
});

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  bio: text("bio").notNull().default(""),
  bannerUrl: text("banner_url"),
  locale: text("locale").notNull().default("ru"),
  theme: text("theme").notNull().default("light"),
});

export const fandoms = pgTable(
  "fandoms",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    tags: text("tags").array().notNull().default([]),
    language: text("language").notNull().default("ru"),
    visibility: visibility("visibility").notNull().default("public"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("fandoms_created_at_idx").on(table.createdAt),
    index("fandoms_public_updated_idx")
      .on(table.updatedAt)
      .where(sql`${table.visibility} = 'public'`),
  ],
);

export const fandomMembers = pgTable(
  "fandom_members",
  {
    id: text("id").primaryKey(),
    fandomId: text("fandom_id")
      .notNull()
      .references(() => fandoms.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fandom_members_unique").on(table.fandomId, table.userId),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fandomId: text("fandom_id")
      .notNull()
      .references(() => fandoms.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("favorites_user_fandom_unique").on(
      table.userId,
      table.fandomId,
    ),
  ],
);

export const pages = pgTable(
  "pages",
  {
    id: text("id").primaryKey(),
    fandomId: text("fandom_id")
      .notNull()
      .references(() => fandoms.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    markdown: text("markdown").notNull(),
    summary: text("summary").notNull().default(""),
    tags: text("tags").array().notNull().default([]),
    status: pageStatus("status").notNull().default("draft"),
    categories: text("categories").array().notNull().default([]),
    cover: text("cover").notNull().default(""),
    deletedAt: timestamp("deleted_at"),
    blockedAt: timestamp("blocked_at"),
    moderationRevision: integer("moderation_revision").notNull().default(0),
    revision: integer("revision").notNull().default(1),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("pages_fandom_slug_unique").on(table.fandomId, table.slug),
    index("pages_updated_idx").on(table.updatedAt),
    index("pages_fandom_published_updated_idx")
      .on(table.fandomId, table.updatedAt)
      .where(
        sql`${table.status} = 'published' and ${table.deletedAt} is null and ${table.blockedAt} is null`,
      ),
    index("pages_author_updated_idx").on(table.authorId, table.updatedAt),
  ],
);

export const pageRevisions = pgTable(
  "page_revisions",
  {
    id: text("id").primaryKey(),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    title: text("title").notNull(),
    markdown: text("markdown").notNull(),
    snapshot: jsonb("snapshot").$type<{
      summary: string;
      tags: string[];
      categories: string[];
      cover: string;
    }>(),
    editorId: text("editor_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("page_revisions_unique").on(table.pageId, table.revision),
  ],
);

export const userThemes = pgTable(
  "user_themes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    theme: jsonb("theme").$type<DesignTheme>().notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_themes_user_name").on(table.userId, table.name),
  ],
);

export const fandomDesigns = pgTable("fandom_designs", {
  fandomId: text("fandom_id")
    .primaryKey()
    .references(() => fandoms.id, { onDelete: "cascade" }),
  draft: jsonb("draft").$type<DesignDocument>().notNull(),
  published: jsonb("published").$type<DesignDocument>(),
  revision: integer("revision").notNull().default(0),
  publishedRevision: integer("published_revision"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const designVersions = pgTable(
  "design_versions",
  {
    id: text("id").primaryKey(),
    fandomId: text("fandom_id")
      .notNull()
      .references(() => fandoms.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    document: jsonb("document").$type<DesignDocument>().notNull(),
    published: boolean("published").notNull(),
    editorId: text("editor_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("design_versions_fandom_revision").on(
      table.fandomId,
      table.revision,
    ),
  ],
);

export const fandomRelations = relations(fandoms, ({ many, one }) => ({
  pages: many(pages),
  owner: one(user, { fields: [fandoms.ownerId], references: [user.id] }),
}));

export const pageDesigns = pgTable("page_designs", {
  pageId: text("page_id")
    .primaryKey()
    .references(() => pages.id, { onDelete: "cascade" }),
  draft: jsonb("draft").$type<DesignDocument>().notNull(),
  published: jsonb("published").$type<DesignDocument>(),
  revision: integer("revision").notNull().default(0),
  publishedRevision: integer("published_revision"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pageDesignVersions = pgTable(
  "page_design_versions",
  {
    id: text("id").primaryKey(),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    document: jsonb("document").$type<DesignDocument>().notNull(),
    published: boolean("published").notNull(),
    editorId: text("editor_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("page_design_versions_fandom_revision").on(
      table.pageId,
      table.revision,
    ),
  ],
);

export const media = pgTable(
  "media",
  {
    id: text("id").primaryKey(),
    fandomId: text("fandom_id")
      .notNull()
      .references(() => fandoms.id, { onDelete: "cascade" }),
    uploaderId: text("uploader_id")
      .notNull()
      .references(() => user.id),
    name: text("name").notNull(),
    alt: text("alt").notNull(),
    data: text("data").notNull(),
    bytes: integer("bytes").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("media_fandom_idx").on(t.fandomId)],
);

export const articleTranslations = pgTable(
  "article_translations",
  {
    id: text("id").primaryKey(),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    sourceRevision: integer("source_revision").notNull(),
    sourceLanguage: text("source_language").notNull(),
    targetLanguage: text("target_language").notNull(),
    sourceHash: text("source_hash").notNull(),
    provider: text("provider").notNull(),
    engineVersion: text("engine_version").notNull(),
    status: text("status").$type<"pending" | "ready" | "failed">().notNull(),
    attemptId: text("attempt_id").notNull(),
    retryAt: timestamp("retry_at").notNull(),
    content: jsonb("content").$type<TranslatedContent>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("article_translations_page_idx").on(t.pageId)],
);

export const translationCorrections = pgTable("translation_corrections", {
  translationId: text("translation_id")
    .primaryKey()
    .references(() => articleTranslations.id, { onDelete: "cascade" }),
  content: jsonb("content").$type<TranslatedContent>().notNull(),
  version: integer("version").notNull().default(1),
  editorId: text("editor_id")
    .notNull()
    .references(() => user.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const reports = pgTable(
  "reports",
  {
    id: text("id").primaryKey(),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => user.id),
    reason: text("reason")
      .$type<"spam" | "abuse" | "personal_data" | "other">()
      .notNull(),
    details: text("details").notNull(),
    snapshot: jsonb("snapshot")
      .$type<{
        title: string;
        summary: string;
        markdown: string;
        revision: number;
      }>()
      .notNull(),
    status: text("status")
      .$type<"open" | "resolved">()
      .notNull()
      .default("open"),
    decision: text("decision").$type<"dismiss" | "block">(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (t) => [
    uniqueIndex("reports_open_reporter_page")
      .on(t.reporterId, t.pageId)
      .where(sql`${t.status} = 'open'`),
    index("reports_status_created_idx").on(t.status, t.createdAt),
    index("reports_reporter_idx").on(t.reporterId),
  ],
);

export const moderationEvents = pgTable(
  "moderation_events",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    action: text("action").$type<"dismiss" | "block" | "unblock">().notNull(),
    note: text("note").notNull(),
    moderationRevision: integer("moderation_revision").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("moderation_events_page_idx").on(t.pageId)],
);
