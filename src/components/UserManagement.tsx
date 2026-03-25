import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from '../types';
import { Users, Shield, Trash2, UserCog, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data() } as User));
      setUsers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return unsubscribe;
  }, []);

  const handleUpdateRole = async (uid: string, newRole: 'admin' | 'manager') => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!confirm('Are you sure you want to remove this user?')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  };

  if (loading) return <div className="p-12 text-center font-mono animate-pulse">Loading User Directory...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tighter italic font-serif">User Management</h2>
        <p className="text-xs font-mono text-[#141414]/50 uppercase tracking-widest">Manage administrative access and roles</p>
      </div>

      <div className="bg-white border border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#141414]/5 border-b border-[#141414]">
              <th className="p-4 text-[10px] font-mono uppercase tracking-widest text-[#141414]/50">User</th>
              <th className="p-4 text-[10px] font-mono uppercase tracking-widest text-[#141414]/50">Role</th>
              <th className="p-4 text-[10px] font-mono uppercase tracking-widest text-[#141414]/50">Access Level</th>
              <th className="p-4 text-[10px] font-mono uppercase tracking-widest text-[#141414]/50 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141414]/10">
            {users.map((user) => (
              <tr key={user.uid} className="hover:bg-[#141414]/5 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#141414] flex items-center justify-center text-white text-xs font-mono">
                      {user.email[0].toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">{user.displayName || 'Anonymous User'}</span>
                      <span className="text-[10px] font-mono text-[#141414]/50 uppercase">{user.email}</span>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-mono uppercase tracking-widest font-bold border",
                    user.role === 'admin' ? "bg-red-50 text-red-700 border-red-700" : "bg-blue-50 text-blue-700 border-blue-700"
                  )}>
                    <Shield className="w-3 h-3" />
                    {user.role}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleUpdateRole(user.uid, 'admin')}
                      className={cn(
                        "px-2 py-1 text-[9px] font-mono uppercase border transition-all",
                        user.role === 'admin' ? "bg-[#141414] text-white border-[#141414]" : "border-[#141414]/20 hover:border-[#141414]"
                      )}
                    >
                      Admin
                    </button>
                    <button 
                      onClick={() => handleUpdateRole(user.uid, 'manager')}
                      className={cn(
                        "px-2 py-1 text-[9px] font-mono uppercase border transition-all",
                        user.role === 'manager' ? "bg-[#141414] text-white border-[#141414]" : "border-[#141414]/20 hover:border-[#141414]"
                      )}
                    >
                      Manager
                    </button>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <button 
                    onClick={() => handleDeleteUser(user.uid)}
                    className="p-2 text-red-500 hover:bg-red-50 transition-colors rounded border border-transparent hover:border-red-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
