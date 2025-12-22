import db from "../db-instance";

export interface Tag {
  id: number;
  name: string;
  color?: string;
}

export const tagRepository = {
  getAll: () => {
    return db.prepare("SELECT * FROM tags ORDER BY id ASC").all() as Tag[];
  },

  create: (name: string, color: string = "#3B82F6") => {
    const stmt = db.prepare(
      "INSERT INTO tags (name, color) VALUES (?, ?)"
    );
    const result = stmt.run(name, color);
    return {
      id: result.lastInsertRowid as number,
      name,
      color,
    };
  },

  delete: (id: number) => {
    db.prepare("DELETE FROM tags WHERE id = ?").run(id);
  },

  getById: (id: number) => {
    return db.prepare("SELECT * FROM tags WHERE id = ?").get(id) as Tag | undefined;
  },

  update: (id: number, name: string, color: string) => {
    const stmt = db.prepare("UPDATE tags SET name = ?, color = ? WHERE id = ?");
    stmt.run(name, color, id);
    return { id, name, color };
  },
};
