import { useState, useEffect, type FormEvent } from 'react';
import './AdminPanel.css';

interface UserInfo {
  id: number;
  username: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: string;
}

export function AdminPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  // Change password
  const [changePwId, setChangePwId] = useState<number | null>(null);
  const [newPw, setNewPw] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/users', { credentials: 'include' });
      if (res.ok) setUsers(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) fetchUsers();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword || !newDisplayName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          displayName: newDisplayName.trim(),
          isAdmin: newIsAdmin,
        }),
      });
      if (res.ok) {
        setNewUsername('');
        setNewPassword('');
        setNewDisplayName('');
        setNewIsAdmin(false);
        setShowCreate(false);
        fetchUsers();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Failed to create user');
      }
    } catch {
      setError('Connection error');
    }
    setCreating(false);
  };

  const handleDelete = async (user: UserInfo) => {
    if (!confirm(`Delete user "${user.displayName}" (${user.username})?`)) return;
    const res = await fetch(`/api/auth/users/${user.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      fetchUsers();
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || 'Failed to delete user');
    }
  };

  const handleResetPassword = async (id: number) => {
    if (!newPw) return;
    const res = await fetch(`/api/auth/users/${id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ newPassword: newPw }),
    });
    if (res.ok) {
      setChangePwId(null);
      setNewPw('');
    } else {
      alert('Failed to reset password');
    }
  };

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-dialog" onClick={e => e.stopPropagation()}>
        <div className="admin-header">
          <span className="admin-title">Manage Accounts</span>
          <button className="admin-close" onClick={onClose}>&#x2715;</button>
        </div>

        <div className="admin-body">
          {loading ? (
            <div className="admin-loading">Loading...</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Display Name</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.displayName}</td>
                    <td>{u.isAdmin ? 'Admin' : 'User'}</td>
                    <td className="admin-actions-cell">
                      {changePwId === u.id ? (
                        <span className="admin-pw-inline">
                          <input
                            type="password"
                            placeholder="New password"
                            value={newPw}
                            onChange={e => setNewPw(e.target.value)}
                            className="admin-pw-input"
                            autoFocus
                          />
                          <button className="admin-btn-sm admin-btn-save" onClick={() => handleResetPassword(u.id)}>Set</button>
                          <button className="admin-btn-sm" onClick={() => { setChangePwId(null); setNewPw(''); }}>Cancel</button>
                        </span>
                      ) : (
                        <>
                          <button className="admin-btn-sm" onClick={() => setChangePwId(u.id)}>Reset PW</button>
                          <button className="admin-btn-sm admin-btn-danger" onClick={() => handleDelete(u)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {error && <div className="admin-error">{error}</div>}

          {showCreate ? (
            <form className="admin-create-form" onSubmit={handleCreate}>
              <div className="admin-form-row">
                <label>Username</label>
                <input value={newUsername} onChange={e => setNewUsername(e.target.value)} autoFocus />
              </div>
              <div className="admin-form-row">
                <label>Display Name</label>
                <input value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} />
              </div>
              <div className="admin-form-row">
                <label>Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div className="admin-form-row">
                <label>
                  <input type="checkbox" checked={newIsAdmin} onChange={e => setNewIsAdmin(e.target.checked)} />
                  {' '}Admin
                </label>
              </div>
              <div className="admin-form-actions">
                <button type="button" className="admin-btn" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          ) : (
            <button className="admin-btn admin-btn-primary admin-add-btn" onClick={() => setShowCreate(true)}>
              + Add Account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
