import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

// Memory-based cache of the database to speed up CRUD operations instantly
let dbCache: { users: IUser[]; tasks: ITask[] } | null = null;

// Ensure database file initialization
function initDb() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], tasks: [] }, null, 2));
  }
}

function readDb() {
  if (dbCache) {
    return dbCache;
  }
  initDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    dbCache = JSON.parse(data);
    return dbCache!;
  } catch (error) {
    console.error('Error reading database file:', error);
    return { users: [], tasks: [] };
  }
}

function writeDb(data: any) {
  dbCache = data;
  try {
    // Write asynchronously to be non-blocking and ultra fast, while keeping safety
    fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), (err) => {
      if (err) console.error('Error writing database to file:', err);
    });
  } catch (error) {
    console.error('Error writing database file:', error);
  }
}

// Generate secure simple IDs
function generateId() {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

// Database Interfaces
export interface IUser {
  _id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface ITask {
  _id: string;
  title: string;
  status: 'todo' | 'in progress' | 'done';
  userId: string;
  createdAt: string;
}

// Emulating a clean, reliable query model for Mongoose-style operations
export const User = {
  async findOne(query: { email?: string; username?: string }): Promise<IUser | null> {
    const db = readDb();
    const user = db.users.find((u: IUser) => {
      if (query.email && u.email.toLowerCase() === query.email.toLowerCase()) return true;
      if (query.username && u.username.toLowerCase() === query.username.toLowerCase()) return true;
      return false;
    });
    return user || null;
  },

  async create(userData: { username: string; email: string; passwordHash: string }): Promise<IUser> {
    const db = readDb();
    const newUser: IUser = {
      _id: generateId(),
      username: userData.username,
      email: userData.email,
      passwordHash: userData.passwordHash,
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    writeDb(db);
    return newUser;
  }
};

export const Task = {
  async find(query: { userId: string }): Promise<ITask[]> {
    const db = readDb();
    return db.tasks
      .filter((t: ITask) => t.userId === query.userId)
      .sort((a: ITask, b: ITask) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async findOne(query: { _id: string }): Promise<ITask | null> {
    const db = readDb();
    const task = db.tasks.find((t: ITask) => t._id === query._id);
    return task || null;
  },

  async create(taskData: { title: string; status: 'todo' | 'in progress' | 'done'; userId: string }): Promise<ITask> {
    const db = readDb();
    const newTask: ITask = {
      _id: generateId(),
      title: taskData.title,
      status: taskData.status || 'todo',
      userId: taskData.userId,
      createdAt: new Date().toISOString()
    };
    db.tasks.push(newTask);
    writeDb(db);
    return newTask;
  },

  async findByIdAndUpdate(id: string, update: { title?: string; status?: 'todo' | 'in progress' | 'done' }): Promise<ITask | null> {
    const db = readDb();
    const taskIdx = db.tasks.findIndex((t: ITask) => t._id === id);
    if (taskIdx === -1) return null;

    db.tasks[taskIdx] = {
      ...db.tasks[taskIdx],
      ...update
    };
    writeDb(db);
    return db.tasks[taskIdx];
  },

  async findByIdAndDelete(id: string): Promise<boolean> {
    const db = readDb();
    const initialLen = db.tasks.length;
    db.tasks = db.tasks.filter((t: ITask) => t._id !== id);
    writeDb(db);
    return db.tasks.length < initialLen;
  }
};

export function mongooseConnect() {
  console.log('MongoDB emulation active: Connected to persistent local JSON datastore at data/db.json');
}
