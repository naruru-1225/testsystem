import db from "../db/db-instance";

export interface Subject {
  id: number;
  name: string;
  display_order: number;
}

export interface SubjectWithUsage extends Subject {
  usage_count: number;
}

export const subjectRepository = {
  getAll: () => {
    return db.prepare("SELECT * FROM subjects ORDER BY display_order, name").all() as Subject[];
  },

  getAllWithUsageCounts: () => {
    return db.prepare(`
      SELECT s.*, COUNT(t.id) as usage_count
      FROM subjects s
      LEFT JOIN tests t ON t.subject = s.name
      GROUP BY s.id
      ORDER BY s.display_order, s.name
    `).all() as SubjectWithUsage[];
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

  updateOrder: (id: number, displayOrder: number) => {
    db.prepare("UPDATE subjects SET display_order = ? WHERE id = ?").run(displayOrder, id);
  },

  delete: (id: number) => {
    db.prepare("DELETE FROM subjects WHERE id = ?").run(id);
  }
};
