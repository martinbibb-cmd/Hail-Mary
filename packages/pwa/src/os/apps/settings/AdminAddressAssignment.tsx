/**
 * AdminAddressAssignment Component
 *
 * Admin-only section for assigning addresses to users
 */

import React, { useState, useEffect } from 'react';
import './AdminAddressAssignment.css';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Address {
  id: string;
  line1: string;
  line2: string | null;
  town: string | null;
  postcode: string;
  customerName: string | null;
  assignedUserId: number | null;
  createdByUserId: number;
}

export const AdminAddressAssignment: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersResponse, addressesResponse] = await Promise.all([
        fetch('/api/admin/users', { credentials: 'include' }),
        fetch('/api/addresses', { credentials: 'include' }),
      ]);

      const usersData = await usersResponse.json();
      const addressesData = await addressesResponse.json();

      if (usersData.success && usersData.data) {
        setUsers(usersData.data);
      } else {
        throw new Error(usersData.error || 'Failed to fetch users');
      }

      if (addressesData.success && addressesData.data) {
        setAddresses(addressesData.data);
      } else {
        throw new Error(addressesData.error || 'Failed to fetch addresses');
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError((err as Error).message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (addressId: string, userId: number | null) => {
    try {
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/addresses/${addressId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          assignedUserId: userId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to assign address');
      }

      setSuccess(
        userId
          ? `Address assigned to ${users.find(u => u.id === userId)?.name || 'user'}`
          : 'Address unassigned'
      );

      // Refresh addresses
      await fetchData();
    } catch (err) {
      console.error('Failed to assign address:', err);
      setError((err as Error).message || 'Failed to assign address');
    }
  };

  const filteredAddresses = addresses.filter(address => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      address.postcode.toLowerCase().includes(query) ||
      address.line1.toLowerCase().includes(query) ||
      address.customerName?.toLowerCase().includes(query) ||
      false
    );
  }).filter(address => {
    if (!selectedUserId) return true;
    return address.assignedUserId === selectedUserId;
  });

  if (loading) {
    return (
      <div className="admin-address-assignment">
        <h3>📍 Address Assignment</h3>
        <div className="admin-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="admin-address-assignment">
      <div className="admin-header">
        <h3>📍 Address Assignment</h3>
        <button className="admin-refresh-btn" onClick={fetchData} title="Refresh">
          🔄 Refresh
        </button>
      </div>

      <p className="admin-description">
        Assign addresses to specific users. Assigned users will have access to view and manage these addresses.
      </p>

      {error && (
        <div className="admin-error-banner">
          <p>⚠️ {error}</p>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {success && (
        <div className="admin-success-banner">
          <p>✅ {success}</p>
          <button onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      <div className="admin-filters">
        <div className="admin-filter-group">
          <label>Search Addresses:</label>
          <input
            type="text"
            placeholder="Search by postcode, address, or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="admin-filter-group">
          <label>Filter by User:</label>
          <select
            value={selectedUserId || ''}
            onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">All Addresses</option>
            <option value="0">Unassigned</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Total Addresses</div>
          <div className="admin-stat-value">{addresses.length}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Assigned</div>
          <div className="admin-stat-value">
            {addresses.filter(a => a.assignedUserId).length}
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Unassigned</div>
          <div className="admin-stat-value">
            {addresses.filter(a => !a.assignedUserId).length}
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Showing</div>
          <div className="admin-stat-value">{filteredAddresses.length}</div>
        </div>
      </div>

      <div className="admin-addresses-list">
        {filteredAddresses.length === 0 && (
          <div className="admin-empty-state">
            <p>No addresses match your filters</p>
          </div>
        )}

        {filteredAddresses.map(address => {
          const assignedUser = users.find(u => u.id === address.assignedUserId);
          const createdByUser = users.find(u => u.id === address.createdByUserId);

          return (
            <div key={address.id} className="admin-address-card">
              <div className="admin-address-info">
                <h4>{address.customerName || 'Unnamed Property'}</h4>
                <p className="admin-address-line">
                  {address.line1}
                  {address.line2 && `, ${address.line2}`}
                </p>
                {address.town && <p className="admin-address-line">{address.town}</p>}
                <p className="admin-address-postcode">{address.postcode}</p>
                <p className="admin-address-meta">
                  Created by: {createdByUser?.name || `User #${address.createdByUserId}`}
                </p>
              </div>

              <div className="admin-address-assignment-control">
                <label>Assign to:</label>
                <select
                  value={address.assignedUserId || ''}
                  onChange={(e) =>
                    handleAssign(address.id, e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">Unassigned</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
                {assignedUser && (
                  <div className="admin-address-assigned-badge">
                    ✓ Assigned to {assignedUser.name}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
