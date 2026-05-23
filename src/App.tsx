import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trash2, 
  Plus, 
  LogOut, 
  CheckCircle2, 
  Circle, 
  PlayCircle, 
  Search, 
  Download, 
  User as UserIcon, 
  CheckCircle,
  Clock,
  ClipboardList
} from 'lucide-react';
import { ITask, IUser } from './types';

export default function App() {
  // Page routing state
  const [currentPage, setCurrentPage] = useState<'login' | 'register' | 'dashboard'>('login');
  
  // Auth state
  const [user, setUser] = useState<IUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Task states
  const [tasks, setTasks] = useState<ITask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'todo' | 'in progress' | 'done'>('all');
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskActionLoadingId, setTaskActionLoadingId] = useState<string | null>(null);

  // PWA Invite States
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  // Check persisted auth sessions
  useEffect(() => {
    const savedToken = localStorage.getItem('task_token');
    const savedUser = localStorage.getItem('task_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        setCurrentPage('dashboard');
      } catch (e) {
        // Clear corrupt session
        localStorage.removeItem('task_token');
        localStorage.removeItem('task_user');
      }
    }

    // Intercept PWA Install Banner
    const pwaHandler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', pwaHandler);
    return () => window.removeEventListener('beforeinstallprompt', pwaHandler);
  }, []);

  // Fetch users' tasks
  const fetchTasks = async (authToken: string) => {
    setTasksLoading(true);
    setTaskError(null);
    try {
      const res = await fetch('/api/tasks', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch tasks.');
      }
      const data = await res.json();
      setTasks(data);
    } catch (err: any) {
      setTaskError(err.message);
    } finally {
      setTasksLoading(false);
    }
  };

  // Trigger tasks fetch when logged in
  useEffect(() => {
    if (token) {
      fetchTasks(token);
    }
  }, [token]);

  // Handle PWA Install triggers
  const handlePwaInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA Prompt choice outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  // Auth operations
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!regUsername || !regEmail || !regPassword) {
      setAuthError('All fields must be filled.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername,
          email: regEmail,
          password: regPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      // Persist auth
      localStorage.setItem('task_token', data.token);
      localStorage.setItem('task_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      
      // Reset form
      setRegUsername('');
      setRegEmail('');
      setRegPassword('');
      setRegConfirmPassword('');
      
      setCurrentPage('dashboard');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!loginEmail || !loginPassword) {
      setAuthError('Email and password must be filled.');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication error.');
      }

      // Persist auth
      localStorage.setItem('task_token', data.token);
      localStorage.setItem('task_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);

      // Reset form
      setLoginEmail('');
      setLoginPassword('');
      
      setCurrentPage('dashboard');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('task_token');
    localStorage.removeItem('task_user');
    setToken(null);
    setUser(null);
    setTasks([]);
    setAuthError(null);
    setCurrentPage('login');
  };

  // Task Operations
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !token) return;

    setTaskError(null);
    const originalTasks = [...tasks];
    
    // Optimistic UI updates to keep interactions lightning-fast!
    const tempId = 'temp-' + Date.now();
    const tempTask: ITask = {
      _id: tempId,
      title: newTaskTitle.trim(),
      status: 'todo',
      userId: user?.id || '',
      createdAt: new Date().toISOString()
    };
    setTasks([tempTask, ...tasks]);
    setNewTaskTitle('');

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: tempTask.title })
      });

      if (!res.ok) {
        throw new Error('Could not add task. Please retry.');
      }

      const savedTask = await res.json();
      
      // Swap temp task with persisted response
      setTasks(currentTasks => 
        currentTasks.map(t => t._id === tempId ? savedTask : t)
      );
    } catch (err: any) {
      setTasks(originalTasks);
      setTaskError(err.message);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'todo' | 'in progress' | 'done') => {
    if (!token) return;
    setTaskError(null);
    setTaskActionLoadingId(id);

    const originalTasks = [...tasks];
    
    // Optimistic UI update
    setTasks(currentTasks => 
      currentTasks.map(t => t._id === id ? { ...t, status: newStatus } : t)
    );

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) {
        throw new Error('Could not update status.');
      }
    } catch (err: any) {
      setTasks(originalTasks);
      setTaskError(err.message);
    } finally {
      setTaskActionLoadingId(null);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!token) return;
    setTaskError(null);

    const originalTasks = [...tasks];
    
    // Optimistic removal
    setTasks(currentTasks => currentTasks.filter(t => t._id !== id));

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Could not delete task.');
      }
    } catch (err: any) {
      setTasks(originalTasks);
      setTaskError(err.message);
    }
  };

  // Derived Task Statistics & Filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(taskSearchQuery.toLowerCase());
      const matchesFilter = taskStatusFilter === 'all' || task.status === taskStatusFilter;
      return matchesSearch && matchesFilter;
    });
  }, [tasks, taskStatusFilter, taskSearchQuery]);

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in progress').length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, todo, percent };
  }, [tasks]);


  // RENDER SELECTION
  return (
    <div className="min-h-screen bg-[#f7f9f6] flex flex-col antialiased">
      
      {/* HEADER SECTION */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-green-100 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center text-white shadow-sm">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h1 id="app-title" className="text-lg font-bold tracking-tight text-green-900 leading-none">Bring</h1>
              <p className="text-[10px] text-green-700/80 font-mono tracking-wider font-semibold uppercase mt-0.5">MongoDB Task Suite</p>
            </div>
          </div>

          {token && user && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-semibold text-green-900 leading-none">{user.username}</span>
                <span className="text-[10px] text-green-600 truncate max-w-[150px]">{user.email}</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-green-50 border border-green-100 flex items-center justify-center text-green-800 text-xs font-bold font-mono">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <button 
                id="logout-btn"
                onClick={handleLogout}
                className="p-1.5 text-green-700 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4.5 h-4.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* RENDER VIEWS */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 sm:py-8 flex flex-col justify-start">
        
        {currentPage === 'login' && !token && (
          <div className="max-w-md w-full mx-auto my-auto py-8">
            <div id="login-card" className="bg-white rounded-2xl border border-green-100 shadow-md p-6 sm:p-8">
              <div className="text-center mb-6">
                <span className="inline-flex p-2.5 rounded-xl bg-green-50 text-green-700 mb-3">
                  <ClipboardList className="w-6 h-6" />
                </span>
                <h2 className="text-xl font-bold text-green-950">Welcome back</h2>
                <p className="text-sm text-green-700/70 mt-1">Please enter details to log in to your dashboard</p>
              </div>

              {authError && (
                <div id="login-err-alert" className="mb-4 p-3 bg-red-50 border border-red-100 text-red-800 text-sm rounded-lg font-medium">
                  {authError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-semibold text-green-900 mb-1 uppercase tracking-wide">Registered Email Address</label>
                  <input 
                    id="login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-green-400 focus:border-green-400 bg-green-50/10 placeholder-green-700/30 text-green-950"
                    placeholder="you@domain.com"
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-xs font-semibold text-green-900 mb-1 uppercase tracking-wide">Password</label>
                  <input 
                    id="login-password"
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-green-400 focus:border-green-400 bg-green-50/10 placeholder-green-700/30 text-green-950"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  id="login-submit-btn"
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-xs active:translate-y-[1px] disabled:opacity-50 cursor-pointer text-center"
                >
                  {authLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-green-50 text-center text-xs text-green-800/80">
                New user?{' '}
                <button 
                  onClick={() => { setCurrentPage('register'); setAuthError(null); }}
                  className="text-green-700 font-semibold hover:underline cursor-pointer"
                >
                  Create a free account
                </button>
              </div>
            </div>
          </div>
        )}

        {currentPage === 'register' && !token && (
          <div className="max-w-md w-full mx-auto my-auto py-8">
            <div id="register-card" className="bg-white rounded-2xl border border-green-100 shadow-md p-6 sm:p-8">
              <div className="text-center mb-6">
                <span className="inline-flex p-2.5 rounded-xl bg-green-50 text-green-700 mb-3">
                  <UserIcon className="w-6 h-6" />
                </span>
                <h2 className="text-xl font-bold text-green-950">Create Account</h2>
                <p className="text-sm text-green-700/70 mt-1">Get started with a simple, persistent task manager</p>
              </div>

              {authError && (
                <div id="register-err-alert" className="mb-4 p-3 bg-red-50 border border-red-100 text-red-800 text-sm rounded-lg font-medium">
                  {authError}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label htmlFor="reg-username" className="block text-xs font-semibold text-green-900 mb-1 uppercase tracking-wide">Username</label>
                  <input 
                    id="reg-username"
                    type="text"
                    required
                    minLength={3}
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-green-400 focus:border-green-400 bg-green-50/10 placeholder-green-700/30 text-green-950"
                    placeholder="alex_smith"
                  />
                </div>

                <div>
                  <label htmlFor="reg-email" className="block text-xs font-semibold text-green-900 mb-1 uppercase tracking-wide">Email address</label>
                  <input 
                    id="reg-email"
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-green-400 focus:border-green-400 bg-green-50/10 placeholder-green-700/30 text-green-950"
                    placeholder="alex@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="reg-password" className="block text-xs font-semibold text-green-900 mb-1 uppercase tracking-wide">Password (min 6 chars)</label>
                  <input 
                    id="reg-password"
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-green-400 focus:border-green-400 bg-green-50/10 placeholder-green-700/30 text-green-950"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-green-900 mb-1 uppercase tracking-wide">Confirm Password</label>
                  <input 
                    id="reg-confirm-password"
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-green-400 focus:border-green-400 bg-green-50/10 placeholder-green-700/30 text-green-950"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  id="reg-submit-btn"
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-xs active:translate-y-[1px] disabled:opacity-50 cursor-pointer text-center"
                >
                  {authLoading ? 'Creating User...' : 'Sign Up'}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-green-50 text-center text-xs text-green-800/80">
                Already registered?{' '}
                <button 
                  onClick={() => { setCurrentPage('login'); setAuthError(null); }}
                  className="text-green-700 font-semibold hover:underline cursor-pointer"
                >
                  Sign in to your account
                </button>
              </div>
            </div>
          </div>
        )}

        {token && user && currentPage === 'dashboard' && (
          <div className="space-y-6">
            
            {/* PWA INSTALL ACCENT BANNER */}
            {showInstallBtn && (
              <div id="pwa-install-banner" className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-800 shrink-0">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-green-950">Install Safe Offline PWA App</h3>
                    <p className="text-xs text-green-800/80">Add Bring to your homescreen. Launch immediately as a native app and operate offline!</p>
                  </div>
                </div>
                <button
                  id="install-pwa-btn"
                  onClick={handlePwaInstall}
                  className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer shadow-xs active:translate-y-px"
                >
                  Add to Home Screen
                </button>
              </div>
            )}

            {/* PRODUCTIVITY COUNTER PROGRESS CARD */}
            <div id="stats-card" className="bg-white rounded-2xl border border-green-100 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-1 w-full md:w-auto">
                <h3 className="text-xs font-bold text-green-900 uppercase tracking-widest leading-none">Your Progress Report</h3>
                <h2 className="text-xl font-bold text-green-950 font-heading">
                  {taskStats.percent}% Completed
                </h2>
                <p className="text-xs text-green-800/80">
                  {taskStats.completed} of {taskStats.total} active tasks completed securely
                </p>
              </div>

              {/* BAR VISUAL */}
              <div className="w-full md:w-60 space-y-2 shrink-0">
                <div className="w-full bg-green-100/50 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-green-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${taskStats.percent}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-green-800 font-mono">
                  <span>Todo ({taskStats.todo})</span>
                  <span>In Progress ({taskStats.inProgress})</span>
                  <span>Done ({taskStats.completed})</span>
                </div>
              </div>
            </div>

            {/* QUICK ADD TASK CARD */}
            <div id="add-task-card" className="bg-white rounded-2xl border border-green-100 p-5 shadow-xs">
              <h3 className="text-sm font-bold text-green-950 mb-3 block">Create New Task</h3>
              <form onSubmit={handleAddTask} className="flex gap-2">
                <input
                  id="new-task-title-input"
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="What is your next goal?"
                  className="flex-1 px-3 py-2 border border-green-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-green-400 bg-green-50/10 placeholder-green-700/30 text-green-950"
                  maxLength={100}
                />
                <button
                  id="add-task-submit-btn"
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add Task</span>
                </button>
              </form>
            </div>

            {/* ERROR ALERTS */}
            {taskError && (
              <div id="task-error-alert" className="p-3 bg-red-50 border border-red-100 text-red-800 text-sm rounded-lg font-medium">
                {taskError}
              </div>
            )}

            {/* TASK DASHBOARD CONTROLS (SEARCH & STATUS FILTERS) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              
              {/* STATUS FILTER BUTTON TABS */}
              <div className="flex rounded-lg border border-green-100 bg-white p-1 shadow-2xs shrink-0 self-start">
                {(['all', 'todo', 'in progress', 'done'] as const).map((filter) => {
                  const isActive = taskStatusFilter === filter;
                  return (
                    <button
                      key={filter}
                      onClick={() => setTaskStatusFilter(filter)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer capitalize ${
                        isActive 
                          ? 'bg-green-600 text-white shadow-2xs' 
                          : 'text-green-800 hover:bg-green-50'
                      }`}
                    >
                      {filter}
                    </button>
                  );
                })}
              </div>

              {/* SEARCH FILTER BOX */}
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-2.5 text-green-800">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  id="search-tasks-input"
                  type="text"
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  placeholder="Search task listings..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-green-100 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-green-400 text-green-950 placeholder-green-700/35 shadow-2xs"
                />
              </div>

            </div>

            {/* TASK CARDS CONTROLLER CONTAINER */}
            <div>
              {tasksLoading && tasks.length === 0 ? (
                <div className="text-center py-12 bg-white border border-green-50 rounded-2xl">
                  <div className="inline-block w-8 h-8 rounded-full border-3 border-green-100 border-t-green-600 animate-spin" />
                  <p className="text-sm text-green-700 mt-2">Loading active entries from remote persistent database...</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div id="tasks-empty-state" className="text-center py-12 bg-white border border-green-50 rounded-2xl p-6">
                  <span className="inline-flex p-3 rounded-full bg-green-50 text-green-700 mb-2">
                    <ClipboardList className="w-6 h-6" />
                  </span>
                  <p className="text-sm font-bold text-green-950">No tasks found</p>
                  <p className="text-xs text-green-800/70 mt-1">
                    {taskSearchQuery || taskStatusFilter !== 'all' 
                      ? "Try adjusting filters or searching for something else"
                      : "Create your very first goal using the box above!"}
                  </p>
                </div>
              ) : (
                <div id="tasks-list" className="space-y-3">
                  {filteredTasks.map((task) => {
                    const isDone = task.status === 'done';
                    return (
                      <div 
                        key={task._id} 
                        data-task-id={task._id}
                        className={`group bg-white rounded-xl border p-4 shadow-3xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all hover:border-green-200 ${
                          isDone ? 'border-green-100 bg-green-50/5 opacity-80' : 'border-green-100'
                        }`}
                      >
                        {/* Task Content */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <button
                            onClick={() => handleUpdateStatus(task._id, isDone ? 'todo' : 'done')}
                            className={`mt-0.5 shrink-0 rounded-full transition-colors focus:ring-2 focus:ring-green-400 focus:outline-hidden cursor-pointer ${
                              isDone ? 'text-green-600 hover:text-green-700' : 'text-green-300 hover:text-green-600'
                            }`}
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-5 h-5 fill-green-50" />
                            ) : (
                              <Circle className="w-5 h-5" />
                            )}
                          </button>
                          
                          <div className="min-w-0 pr-3">
                            <span 
                              className={`text-sm font-semibold block truncate leading-snug ${
                                isDone ? 'line-through text-green-900/60' : 'text-green-950'
                              }`}
                            >
                              {task.title}
                            </span>
                            <span className="text-[10px] text-green-600/70 block mt-0.5 font-mono">
                              Created : {new Date(task.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Interactive Status Selector & Delete controls */}
                        <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-green-50">
                          
                          {/* Quick selection pill controls */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleUpdateStatus(task._id, 'todo')}
                              className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                task.status === 'todo'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-green-50/50 hover:bg-green-50 text-green-800 border border-green-100/50'
                              }`}
                            >
                              Todo
                            </button>
                            
                            <button
                              onClick={() => handleUpdateStatus(task._id, 'in progress')}
                              className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                task.status === 'in progress'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-50/50 hover:bg-green-50 text-green-800 border border-green-100/50'
                              }`}
                            >
                              In Progress
                            </button>
                            
                            <button
                              onClick={() => handleUpdateStatus(task._id, 'done')}
                              className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                task.status === 'done'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-green-50/50 hover:bg-green-50 text-green-800 border border-green-100/50'
                              }`}
                            >
                              Done
                            </button>
                          </div>

                          {/* Delete Trash button */}
                          <button
                            id={`delete-btn-${task._id}`}
                            onClick={() => handleDeleteTask(task._id)}
                            className="p-1.5 text-green-800/40 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer group-hover:text-green-800/80"
                            title="Remove Task"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* FOOTER SECTION */}
      <footer className="w-full bg-white border-t border-green-100 py-4 mt-12 shrink-0">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-green-800/70 gap-2">
          <p>© 2026 Bring Task Manager. Persistent and secure in-memory cached MongoDB storage engine.</p>
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 bg-green-50 border border-green-100 rounded-full font-semibold">PWA Install Ready</span>
            <span className="px-2 py-0.5 bg-green-50 border border-green-100 rounded-full font-semibold">MongoDB Core Engine</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
