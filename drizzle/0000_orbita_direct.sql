CREATE TABLE orbita_maps (owner_id TEXT NOT NULL, map_id TEXT NOT NULL, label TEXT NOT NULL, document TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, history TEXT NOT NULL DEFAULT '[]', last_op TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL, PRIMARY KEY(owner_id,map_id));
--> statement-breakpoint
CREATE TABLE orbita_sessions (owner_id TEXT NOT NULL, session_id TEXT NOT NULL, map_id TEXT NOT NULL, view TEXT NOT NULL, last_seen INTEGER NOT NULL, applied_revision INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(owner_id,session_id));
--> statement-breakpoint
CREATE TABLE orbita_active (owner_id TEXT PRIMARY KEY NOT NULL, map_id TEXT NOT NULL, session_id TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE orbita_operations (owner_id TEXT NOT NULL, request_id TEXT NOT NULL, map_id TEXT NOT NULL, session_id TEXT NOT NULL, revision INTEGER NOT NULL, summary TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(owner_id,request_id));
