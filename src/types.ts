export interface ITask {
  _id: string;
  title: string;
  status: 'todo' | 'in progress' | 'done';
  userId: string;
  createdAt: string;
}

export interface IUser {
  id: string;
  username: string;
  email: string;
}

export interface IAuthResponse {
  message: string;
  token: string;
  user: IUser;
}
