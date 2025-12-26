import React, { useState, useEffect } from 'react';
import { useSpineStore } from '../../../stores/spineStore';
import { useAuth } from '../../../auth';
import './AddressesApp.css';

interface Address {
  id: string;
  line1: string;
  line2: string | null;
  town: string | null;
  county: string | null;
  postcode: string;
  country: string;
  customerName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  assignedUserId?: number | null;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export const AddressesApp: React.FC = () => {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const setActiveAddress = useSpineStore((s) => s.setActiveAddress);
  const isAdmin = user?.role === 'admin';

  // Form state
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [town, setTown] = useState('');
  const [county, setCounty] = useState('');
  const [postcode, setPostcode] = useState('');
  const [country, setCountry] = useState('United Kingdom');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedUserId, setAssignedUserId] = useState<number | null>(null);

  useEffect(() => {
    fetchAddresses();
  }, [searchQuery]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success && data.data) {
        setUsers(data.data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const queryParam = searchQuery ? `?query=${encodeURIComponent(searchQuery)}` : '';
      const response = await fetch(`/api/addresses${queryParam}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success && data.data) {
        setAddresses(data.data);
      }
    } catch (err) {
      console.error('Error fetching addresses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setEditingAddress(null);
    setShowModal(true);
    setError(null);
    setSuccess(null);
    resetForm();
  };

  const handleEditAddress = (address: Address, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAddress(address);
    setShowModal(true);
    setError(null);
    setSuccess(null);
    loadFormData(address);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingAddress(null);
    resetForm();
  };

  const resetForm = () => {
    setLine1('');
    setLine2('');
    setTown('');
    setCounty('');
    setPostcode('');
    setCountry('United Kingdom');
    setCustomerName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setAssignedUserId(null);
  };

  const loadFormData = (address: Address) => {
    setLine1(address.line1);
    setLine2(address.line2 || '');
    setTown(address.town || '');
    setCounty(address.county || '');
    setPostcode(address.postcode);
    setCountry(address.country);
    setCustomerName(address.customerName || '');
    setPhone(address.phone || '');
    setEmail(address.email || '');
    setNotes(address.notes || '');
    setAssignedUserId(address.assignedUserId || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!line1.trim() || !postcode.trim()) {
      setError('Address line 1 and postcode are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = editingAddress ? `/api/addresses/${editingAddress.id}` : '/api/addresses';
      const method = editingAddress ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          line1: line1.trim(),
          line2: line2.trim() || undefined,
          town: town.trim() || undefined,
          county: county.trim() || undefined,
          postcode: postcode.trim().toUpperCase(),
          country: country.trim(),
          customerName: customerName.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          notes: notes.trim() || undefined,
          assignedUserId: assignedUserId || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(editingAddress ? 'Address updated successfully!' : 'Address created successfully!');
        await fetchAddresses();
        handleCloseModal();
      } else {
        setError(data.error || `Failed to ${editingAddress ? 'update' : 'create'} address`);
      }
    } catch (err) {
      console.error(`Error ${editingAddress ? 'updating' : 'creating'} address:`, err);
      setError(`Failed to ${editingAddress ? 'update' : 'create'} address`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (address: Address, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm(`Are you sure you want to delete the address for ${address.customerName || address.line1}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/addresses/${address.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Address deleted successfully!');
        await fetchAddresses();
      } else {
        setError(data.error || 'Failed to delete address');
      }
    } catch (err) {
      console.error('Error deleting address:', err);
      setError('Failed to delete address');
    }
  };

  return (
    <div className="addresses-app">
      <div className="addresses-header">
        <h2>Addresses</h2>
        <button className="btn-primary" onClick={handleOpenModal}>
          + New Address
        </button>
      </div>

      {success && (
        <div className="alert alert-success">
          {success}
          <button onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      {error && !showModal && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by postcode, customer name, or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading && <div className="loading">Loading...</div>}

      {!loading && addresses.length === 0 && (
        <div className="empty-state">
          <p>No addresses found. Create your first address!</p>
        </div>
      )}

      {!loading && addresses.length > 0 && (
        <div className="addresses-list">
          {addresses.map((address) => (
            <div
              key={address.id}
              className="address-card"
              onClick={() => {
                setActiveAddress({
                  id: address.id,
                  line1: address.line1,
                  line2: address.line2,
                  town: address.town,
                  postcode: address.postcode,
                  customerName: address.customerName,
                });
                setSuccess(`Set active address: ${address.customerName || address.line1}`);
              }}
              style={{ cursor: 'pointer' }}
            >
              <div className="address-header">
                <h3>{address.customerName || 'Unnamed Property'}</h3>
                <div className="address-actions">
                  <span className="postcode-badge">{address.postcode}</span>
                  <button
                    className="btn-icon btn-edit"
                    onClick={(e) => handleEditAddress(address, e)}
                    title="Edit address"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn-icon btn-delete"
                    onClick={(e) => handleDeleteAddress(address, e)}
                    title="Delete address"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="address-details">
                <p>{address.line1}</p>
                {address.line2 && <p>{address.line2}</p>}
                {address.town && <p>{address.town}</p>}
              </div>
              {(address.phone || address.email) && (
                <div className="address-contact">
                  {address.phone && <span>📞 {address.phone}</span>}
                  {address.email && <span>✉️ {address.email}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Address Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingAddress ? 'Edit Address' : 'Create New Address'}</h3>
              <button className="modal-close" onClick={handleCloseModal}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body">
              {error && (
                <div className="alert alert-error">
                  {error}
                  <button type="button" onClick={() => setError(null)}>×</button>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="customerName">Customer Name (optional)</label>
                <input
                  id="customerName"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Smith"
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label htmlFor="line1">
                  Address Line 1 <span className="required">*</span>
                </label>
                <input
                  id="line1"
                  type="text"
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  placeholder="123 High Street"
                  required
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label htmlFor="line2">Address Line 2 (optional)</label>
                <input
                  id="line2"
                  type="text"
                  value={line2}
                  onChange={(e) => setLine2(e.target.value)}
                  placeholder="Flat 2"
                  disabled={saving}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="town">Town/City</label>
                  <input
                    id="town"
                    type="text"
                    value={town}
                    onChange={(e) => setTown(e.target.value)}
                    placeholder="London"
                    disabled={saving}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="county">County</label>
                  <input
                    id="county"
                    type="text"
                    value={county}
                    onChange={(e) => setCounty(e.target.value)}
                    placeholder="Greater London"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="postcode">
                    Postcode <span className="required">*</span>
                  </label>
                  <input
                    id="postcode"
                    type="text"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                    placeholder="SW1A 1AA"
                    required
                    disabled={saving}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="country">Country</label>
                  <input
                    id="country"
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="phone">Phone (optional)</label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07700 900123"
                    disabled={saving}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email (optional)</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="customer@example.com"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="notes">Notes (optional)</label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional information about this property..."
                  rows={3}
                  disabled={saving}
                />
              </div>

              {isAdmin && users.length > 0 && (
                <div className="form-group">
                  <label htmlFor="assignedUserId">Assign to User (optional)</label>
                  <select
                    id="assignedUserId"
                    value={assignedUserId || ''}
                    onChange={(e) => setAssignedUserId(e.target.value ? parseInt(e.target.value) : null)}
                    disabled={saving}
                  >
                    <option value="">Select a user...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={handleCloseModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? (editingAddress ? 'Updating...' : 'Creating...') : (editingAddress ? 'Update Address' : 'Create Address')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
