import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Switch, Redirect, Link } from 'react-router-dom';
import { Button, AppBar, Toolbar, Typography, Container, TextField } from '@/components/ui';
import { LogIn, LogOut, Send, User, Settings } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const response = await axios.get(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setUsers(response.data);
    };
    fetchUsers();
  }, []);

  const markDeceased = async (userId) => {
    await axios.post(`${API_URL}/admin/mark_deceased/${userId}`, {}, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    // Refresh users after marking one as deceased
    const response = await axios.get(`${API_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    setUsers(response.data);
  };

  return (
    <div>
      <h2>Users</h2>
      <ul>
        {users.map(user => (
          <li key={user.id}>
            {user.username} - {user.email} - {user.role}
            {!user.is_deceased && (
              <Button onClick={() => markDeceased(user.id)}>Mark Deceased</Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

const SenderDashboard = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState({ recipient_email: '', content: '', scheduled_date: '' });

  useEffect(() => {
    const fetchMessages = async () => {
      const response = await axios.get(`${API_URL}/sender/messages`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setMessages(response.data);
    };
    fetchMessages();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post(`${API_URL}/sender/messages`, newMessage, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    // Refresh messages after adding a new one
    const response = await axios.get(`${API_URL}/sender/messages`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    setMessages(response.data);
    setNewMessage({ recipient_email: '', content: '', scheduled_date: '' });
  };

  return (
    <div>
      <h2>Schedule New Message</h2>
      <form onSubmit={handleSubmit}>
        <TextField 
          label="Recipient Email" 
          value={newMessage.recipient_email} 
          onChange={(e) => setNewMessage({...newMessage, recipient_email: e.target.value})}
          required 
        />
        <TextField 
          label="Message Content" 
          multiline 
          rows={4} 
          value={newMessage.content} 
          onChange={(e) => setNewMessage({...newMessage, content: e.target.value})}
          required 
        />
        <TextField 
          label="Scheduled Date" 
          type="datetime-local" 
          value={newMessage.scheduled_date} 
          onChange={(e) => setNewMessage({...newMessage, scheduled_date: e.target.value})}
          required 
        />
        <Button type="submit">Schedule Message</Button>
      </form>
      <h2>Your Scheduled Messages</h2>
      <ul>
        {messages.map(message => (
          <li key={message.id}>
            To: {message.recipient_email} - Scheduled: {new Date(message.scheduled_date).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
};

const LoginForm = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/login`, { email, password });
      localStorage.setItem('token', response.data.access_token);
      onLogin(response.data.role);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <TextField 
        label="Email" 
        type="email" 
        value={email} 
        onChange={(e) => setEmail(e.target.value)}
        required 
      />
      <TextField 
        label="Password" 
        type="password" 
        value={password} 
        onChange={(e) => setPassword(e.target.value)}
        required 
      />
      <Button type="submit">Log In</Button>
    </form>
  );
};

const App = () => {
  const [user, setUser] = useState(null);

  const handleLogin = (role) => {
    setUser({ role });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <AppBar position="static" className="bg-purple-700">
          <Toolbar>
            <Typography variant="h6" className="flex-grow">
              Lastgram
            </Typography>
            {user ? (
              <>
                <Button component={Link} to="/" className="text-white mx-2">
                  <Send className="mr-2" size={20} />
                  Dashboard
                </Button>
                <Button component={Link} to="/profile" className="text-white mx-2">
                  <User className="mr-2" size={20} />
                  Profile
                </Button>
                <Button component={Link} to="/settings" className="text-white mx-2">
                  <Settings className="mr-2" size={20} />
                  Settings
                </Button>
                <Button onClick={handleLogout} className="text-white">
                  <LogOut className="mr-2" size={20} />
                  Log Out
                </Button>
              </>
            ) : (
              <Button component={Link} to="/login" className="text-white">
                <LogIn className="mr-2" size={20} />
                Log In
              </Button>
            )}
          </Toolbar>
        </AppBar>

        <Container className="mt-8">
          <Switch>
            <Route exact path="/login">
              {user ? <Redirect to="/" /> : <LoginForm onLogin={handleLogin} />}
            </Route>
            <Route exact path="/">
              {!user ? (
                <Redirect to="/login" />
              ) : user.role === 'admin' ? (
                <AdminDashboard />
              ) : user.role === 'sender' ? (
                <SenderDashboard />
              ) : (
                <Redirect to="/login" />
              )}
            </Route>
            <Route path="/profile">
              {!user ? <Redirect to="/login" /> : <div>Profile Page</div>}
            </Route>
            <Route path="/settings">
              {!user ? <Redirect to="/login" /> : <div>Settings Page</div>}
            </Route>
          </Switch>
        </Container>
      </div>
    </Router>
  );
};

export default App;
