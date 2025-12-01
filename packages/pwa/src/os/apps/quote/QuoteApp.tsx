import React, { useState, useEffect } from 'react'
import type { 
  Product,
  QuoteLine,
} from '@hail-mary/shared'
import './QuoteApp.css'

// Sample products for demo
const sampleProducts: Product[] = [
  { id: '1', name: 'Worcester Bosch Greenstar 8000', description: 'High-efficiency combi boiler', category: 'boiler', manufacturer: 'Worcester Bosch', price: 1299, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Vaillant ecoTEC Plus', description: 'Premium combi boiler', category: 'boiler', manufacturer: 'Vaillant', price: 1199, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'Ideal Logic Max', description: 'Compact combi boiler', category: 'boiler', manufacturer: 'Ideal', price: 899, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '4', name: 'Nest Learning Thermostat', description: 'Smart heating control', category: 'controls', manufacturer: 'Google', price: 219, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '5', name: 'Hive Active Heating', description: 'Smart thermostat', category: 'controls', manufacturer: 'Hive', price: 179, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '6', name: 'Installation Labour', description: 'Standard boiler installation', category: 'labour', price: 500, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '7', name: 'Pipework Modification', description: 'Per meter of pipework', category: 'parts', price: 45, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '8', name: 'Magnetic Filter', description: 'System protection filter', category: 'parts', price: 120, isActive: true, createdAt: new Date(), updatedAt: new Date() },
]

interface QuoteLineItem extends QuoteLine {
  product: Product
}

type ViewMode = 'editor' | 'products'

export const QuoteApp: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('editor')
  const [products] = useState<Product[]>(sampleProducts)
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([])
  const [quoteTitle, setQuoteTitle] = useState('New Quote')
  const [vatRate] = useState(20)
  const [discount, setDiscount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [productFilter, setProductFilter] = useState<string>('')

  useEffect(() => {
    // In production, load products from API
    // api.get<PaginatedResponse<Product>>('/api/products')
  }, [])

  const addLineItem = (product: Product) => {
    const existingItem = lineItems.find(item => item.productId === product.id)
    
    if (existingItem) {
      setLineItems(prev => prev.map(item => 
        item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1, lineTotal: (item.quantity + 1) * item.unitPrice }
          : item
      ))
    } else {
      const newItem: QuoteLineItem = {
        id: `line-${Date.now()}`,
        productId: product.id,
        product,
        description: product.name,
        quantity: 1,
        unitPrice: product.price,
        lineTotal: product.price,
      }
      setLineItems(prev => [...prev, newItem])
    }
    
    setViewMode('editor')
    setSaved(false)
  }

  const updateQuantity = (itemId: string | number, quantity: number) => {
    if (quantity <= 0) {
      removeLineItem(itemId)
      return
    }
    
    setLineItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, quantity, lineTotal: quantity * item.unitPrice }
        : item
    ))
    setSaved(false)
  }

  const removeLineItem = (itemId: string | number) => {
    setLineItems(prev => prev.filter(item => item.id !== itemId))
    setSaved(false)
  }

  const subtotal = lineItems.reduce((acc, item) => acc + item.lineTotal, 0)
  const discountAmount = subtotal * (discount / 100)
  const subtotalAfterDiscount = subtotal - discountAmount
  const vatAmount = subtotalAfterDiscount * (vatRate / 100)
  const total = subtotalAfterDiscount + vatAmount

  const handleSave = async () => {
    setLoading(true)
    try {
      // In production, save to API
      await new Promise(resolve => setTimeout(resolve, 500))
      setSaved(true)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productFilter.toLowerCase()) ||
    p.category.toLowerCase().includes(productFilter.toLowerCase())
  )

  const groupedProducts = filteredProducts.reduce((acc, product) => {
    const category = product.category
    if (!acc[category]) acc[category] = []
    acc[category].push(product)
    return acc
  }, {} as Record<string, Product[]>)

  // Product selector view
  if (viewMode === 'products') {
    return (
      <div className="quote-app">
        <div className="quote-app-header">
          <button className="btn-back" onClick={() => setViewMode('editor')}>
            ← Back
          </button>
          <h2>Add Products</h2>
        </div>

        <div className="product-search">
          <input
            type="text"
            placeholder="Search products..."
            value={productFilter}
            onChange={e => setProductFilter(e.target.value)}
          />
        </div>

        <div className="product-list">
          {Object.entries(groupedProducts).map(([category, items]) => (
            <div key={category} className="product-category">
              <h3>{category.charAt(0).toUpperCase() + category.slice(1)}</h3>
              {items.map(product => (
                <button
                  key={product.id}
                  className="product-item"
                  onClick={() => addLineItem(product)}
                >
                  <div className="product-info">
                    <strong>{product.name}</strong>
                    <span>{product.description}</span>
                  </div>
                  <span className="product-price">£{product.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Quote editor view
  return (
    <div className="quote-app">
      <div className="quote-app-header">
        <h2>£ Quote Builder</h2>
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={loading || lineItems.length === 0}
        >
          {loading ? 'Saving...' : saved ? '✓ Saved' : 'Save Quote'}
        </button>
      </div>

      {/* Quote Title */}
      <div className="quote-title-section">
        <input
          type="text"
          className="quote-title-input"
          value={quoteTitle}
          onChange={e => setQuoteTitle(e.target.value)}
          placeholder="Quote Title"
        />
      </div>

      {/* Line Items */}
      <div className="line-items-section">
        <div className="section-header">
          <h3>Line Items</h3>
          <button className="btn-add" onClick={() => setViewMode('products')}>
            + Add Product
          </button>
        </div>

        {lineItems.length === 0 ? (
          <p className="line-items-empty">No items yet. Add products to your quote.</p>
        ) : (
          <div className="line-items-list">
            {lineItems.map(item => (
              <div key={item.id} className="line-item">
                <div className="line-item-info">
                  <strong>{item.description}</strong>
                  <span>£{item.unitPrice.toFixed(2)} each</span>
                </div>
                <div className="line-item-controls">
                  <button 
                    className="qty-btn"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  >
                    −
                  </button>
                  <span className="qty-value">{item.quantity}</span>
                  <button 
                    className="qty-btn"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <span className="line-item-total">£{item.lineTotal.toFixed(2)}</span>
                <button 
                  className="btn-remove"
                  onClick={() => removeLineItem(item.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      {lineItems.length > 0 && (
        <div className="quote-totals">
          <div className="totals-row">
            <span>Subtotal</span>
            <span>£{subtotal.toFixed(2)}</span>
          </div>

          <div className="totals-row discount-row">
            <span>Discount</span>
            <div className="discount-input">
              <input
                type="number"
                value={discount}
                onChange={e => {
                  setDiscount(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))
                  setSaved(false)
                }}
                min={0}
                max={100}
              />
              <span>%</span>
            </div>
            {discountAmount > 0 && (
              <span className="discount-amount">-£{discountAmount.toFixed(2)}</span>
            )}
          </div>

          <div className="totals-row">
            <span>VAT ({vatRate}%)</span>
            <span>£{vatAmount.toFixed(2)}</span>
          </div>

          <div className="totals-row total-row">
            <strong>Total</strong>
            <strong>£{total.toFixed(2)}</strong>
          </div>
        </div>
      )}
    </div>
  )
}
