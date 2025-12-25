import React, { useState, useEffect } from 'react';
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
}

export const AddressesApp: React.FC = () => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAddresses();
  }, [searchQuery]);

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

  return (
    <div className="addresses-app">
      <div className="addresses-header">
        <h2>Addresses</h2>
        <button className="btn-primary" onClick={() => alert('Create address - Coming soon!')}>
          + New Address
        </button>
      </div>

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
            <div key={address.id} className="address-card">
              <div className="address-header">
                <h3>{address.customerName || 'Unnamed Property'}</h3>
                <span className="postcode-badge">{address.postcode}</span>
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
    </div>
  );
};
