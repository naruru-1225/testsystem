import db from "../db/db-instance";

export interface Grade {
  id: number;
  name: string;
  display_order: number;
}

export interface GradeWithUsage extends Grade {
  usage_count: number;
}

export const gradeRepository = {
  getAll: () => {
    return db.prepare("SELECT * FROM grades ORDER BY display_order, name").all() as Grade[];
  },

  getAllWithUsageCounts: () => {
    return db.prepare(`
      SELECT g.*, COUNT(t.id) as usage_count
      FROM grades g
      LEFT JOIN tests t ON t.grade = g.name
      GROUP BY g.id
      ORDER BY g.display_order, g.name
    `).all() as GradeWithUsage[];
  },

  getById: (id: number) => {
    return db.prepare("SELECT * FROM grades WHERE id = ?").get(id) as Grade | undefined;
  },

  create: (name: string, displayOrder: number = 0) => {
    const stmt = db.prepare("INSERT INTO grades (name, display_order) VALUES (?, ?)");
    const result = stmt.run(name, displayOrder);
    return {
      id: result.lastInsertRowid as number,
      name,
      display_order: displayOrder,
    };
  },

  update: (id: number, name: string, displayOrder: number) => {
    const stmt = db.prepare("UPDATE grades SET name = ?, display_order = ? WHERE id = ?");
    stmt.run(name, displayOrder, id);
    return { id, name, display_order: displayOrder };
  },

  updateOrder: (id: number, displayOrder: number) => {
    db.prepare("UPDATE grades SET display_order = ? WHERE id = ?").run(displayOrder, id);
  },

  delete: (id: number) => {
    db.prepare("DELETE FROM grades WHERE id = ?").run(id);
  }
};
