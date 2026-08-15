import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260815104441_add_knowledge_graph",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`knowledge_edge\` (
          \`source_id\` text NOT NULL,
          \`target_id\` text NOT NULL,
          \`kind\` text NOT NULL,
          \`weight\` real DEFAULT 1 NOT NULL,
          \`time_created\` integer NOT NULL,
          CONSTRAINT \`fk_knowledge_edge_source_id_knowledge_node_id_fk\` FOREIGN KEY (\`source_id\`) REFERENCES \`knowledge_node\`(\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_knowledge_edge_target_id_knowledge_node_id_fk\` FOREIGN KEY (\`target_id\`) REFERENCES \`knowledge_node\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`knowledge_node\` (
          \`id\` text PRIMARY KEY,
          \`kind\` text NOT NULL,
          \`title\` text NOT NULL,
          \`body\` text DEFAULT '' NOT NULL,
          \`session_id\` text,
          \`project_id\` text,
          \`message_seq\` integer,
          \`parent_id\` text,
          \`depth\` integer DEFAULT 0 NOT NULL,
          \`embedding\` text,
          \`metadata\` text,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          CONSTRAINT \`fk_knowledge_node_session_id_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_knowledge_node_project_id_project_id_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`project\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(
        `CREATE UNIQUE INDEX \`knowledge_edge_source_target_kind_idx\` ON \`knowledge_edge\` (\`source_id\`,\`target_id\`,\`kind\`);`,
      )
      yield* tx.run(`CREATE INDEX \`knowledge_edge_target_idx\` ON \`knowledge_edge\` (\`target_id\`);`)
      yield* tx.run(`CREATE INDEX \`knowledge_edge_kind_idx\` ON \`knowledge_edge\` (\`kind\`);`)
      yield* tx.run(`CREATE INDEX \`knowledge_node_session_idx\` ON \`knowledge_node\` (\`session_id\`);`)
      yield* tx.run(`CREATE INDEX \`knowledge_node_project_idx\` ON \`knowledge_node\` (\`project_id\`);`)
      yield* tx.run(`CREATE INDEX \`knowledge_node_parent_idx\` ON \`knowledge_node\` (\`parent_id\`);`)
      yield* tx.run(`CREATE INDEX \`knowledge_node_kind_idx\` ON \`knowledge_node\` (\`kind\`);`)
    })
  },
} satisfies DatabaseMigration.Migration
