import db from "../db-instance";

export interface Subject {
  id: number;
  name: string;
  display_order: number;
}

export const subjectRepository = {
  getAll: () => {
    return db.prepare("SELECT * FROM subjects ORDER BY display_order, name").all() as Subject[];
  },

  getById: (id: number) => {
    return db.prepare("SELECT * FROM subjects WHERE id = ?").get(id) as Subject | undefined;
  },

  create: (name: string, displayOrder: number = 0) => {
    const stmt = db.prepare("INSERT INTO subjects (name, display_order) VALUES (?, ?)");
    const result = stmt.run(name, displayOrder);
    return {
      id: result.lastInsertRowid as number,
      name,
      display_order: displayOrder,
    };
  },

  update: (id: number, name: string, displayOrder: number) => {
    const stmt = db.prepare("UPDATE subjects SET name = ?, display_order = ? WHERE id = ?");
    stmt.run(name, displayOrder, id);
    return { id, name, display_order: displayOrder };
  },

  delete: (id: number) => {
    db.prepare("DELETE FROM subjects WHERE id = ?").run(id);
  }
};
