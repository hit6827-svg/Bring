import express from 'express';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { User, Task, mongooseConnect } from './server/db.js';

// Setup environment variables
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_task_manager_key_2026';
const PORT = 3000;

async function startServer() {
  const app = express();
  
  // Connect to persistent storage db
  mongooseConnect();

  // Parse JSON payloads
  app.use(express.json());

  // App logo assets for PWA installability
  app.get('/icon.png', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'src', 'assets', 'images', 'task_logo_1779551517908.png'));
  });
  app.get('/icon-192.png', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'src', 'assets', 'images', 'task_logo_1779551517908.png'));
  });
  app.get('/icon-512.png', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'src', 'assets', 'images', 'task_logo_1779551517908.png'));
  });

  // Serve PWA manifest
  app.get('/manifest.json', (req, res) => {
    res.json({
      short_name: "Bring",
      name: "Bring Task Manager",
      icons: [
        {
          src: "/icon-192.png",
          type: "image/png",
          sizes: "192x192"
        },
        {
          src: "/icon-512.png",
          type: "image/png",
          sizes: "512x512"
        }
      ],
      start_url: "/",
      background_color: "#f4f3ef",
      theme_color: "#16a34a",
      display: "standalone",
      orientation: "portrait"
    });
  });

  // JWT auth middleware
  function authenticateToken(req: any, res: any, next: any) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required. Please authenticate.' });
    }

    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid, revoked, or expired access token.' });
      }
      req.user = decoded;
      next();
    });
  }

  // --- API ROUTES ---

  // Register endpoint
  app.post('/api/register', async (req, res) => {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email and password are required.' });
      }

      if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }

      // Check existing users
      const existingUserEmail = await User.findOne({ email });
      if (existingUserEmail) {
        return res.status(400).json({ error: 'Email already registered.' });
      }

      const existingUserName = await User.findOne({ username });
      if (existingUserName) {
        return res.status(400).json({ error: 'Username is already taken.' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const user = await User.create({ username, email, passwordHash });

      // Generate JWT
      const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        message: 'Account registered successfully.',
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error during registration.' });
    }
  });

  // Login endpoint
  app.post('/api/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ error: 'Invalid registered email or password.' });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(400).json({ error: 'Invalid registered email or password.' });
      }

      // Generate JWT
      const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

      res.status(200).json({
        message: 'Login successful.',
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error during login.' });
    }
  });

  // Get active user's tasks
  app.get('/api/tasks', authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const tasks = await Task.find({ userId });
      res.status(200).json(tasks);
    } catch (error) {
      console.error('Fetch tasks error:', error);
      res.status(500).json({ error: 'Internal server error fetching tasks.' });
    }
  });

  // Create a new task
  app.post('/api/tasks', authenticateToken, async (req: any, res) => {
    try {
      const { title, status } = req.body;
      const userId = req.user.userId;

      if (!title) {
        return res.status(400).json({ error: 'Task title is required.' });
      }

      const validStatuses = ['todo', 'in progress', 'done'];
      const taskStatus = status && validStatuses.includes(status) ? status : 'todo';

      const task = await Task.create({
        title,
        status: taskStatus,
        userId
      });

      res.status(201).json(task);
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({ error: 'Internal server error creating task.' });
    }
  });

  // Update a task title or status
  app.put('/api/tasks/:id', authenticateToken, async (req: any, res) => {
    try {
      const taskId = req.params.id;
      const userId = req.user.userId;
      const { title, status } = req.body;

      // Find task and verify owner
      const task = await Task.findOne({ _id: taskId });
      if (!task) {
        return res.status(404).json({ error: 'Task not found.' });
      }

      if (task.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized to access this task.' });
      }

      const updateData: { title?: string; status?: 'todo' | 'in progress' | 'done' } = {};
      if (title !== undefined) updateData.title = title;
      
      const validStatuses = ['todo', 'in progress', 'done'];
      if (status !== undefined && validStatuses.includes(status)) {
        updateData.status = status;
      }

      const updatedTask = await Task.findByIdAndUpdate(taskId, updateData);
      res.status(200).json(updatedTask);
    } catch (error) {
      console.error('Update task error:', error);
      res.status(500).json({ error: 'Internal server error updating task.' });
    }
  });

  // Delete task
  app.delete('/api/tasks/:id', authenticateToken, async (req: any, res) => {
    try {
      const taskId = req.params.id;
      const userId = req.user.userId;

      // Verify task ownership
      const task = await Task.findOne({ _id: taskId });
      if (!task) {
        return res.status(404).json({ error: 'Task not found.' });
      }

      if (task.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized to access this task.' });
      }

      await Task.findByIdAndDelete(taskId);
      res.status(200).json({ message: 'Task deleted successfully.', id: taskId });
    } catch (error) {
      console.error('Delete task error:', error);
      res.status(500).json({ error: 'Internal server error deleting task.' });
    }
  });


  // --- STATIC ASSETS & VITE SERVING ---

  if (process.env.NODE_ENV !== 'production') {
    // Mount Vite dev server in middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production build files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express application active on http://localhost:${PORT}`);
  });
}

startServer();
