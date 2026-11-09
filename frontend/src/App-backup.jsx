
import { useEffect, useState } from 'react'
import './App.css'

const API_URL = 'http://localhost:5000/api/assets'

const emptyAsset = {
  name: '',
  category: 'Chromebook',
  assignedTo: '',
  location: '',
  status: 'Available',
}

function App() {
  const [assets, setAssets] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [newAsset, setNewAsset] = useState(emptyAsset)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadAssets() {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(API_URL)

      if (!response.ok) {
        throw new Error('Could not load assets from the server.')
      }

      const data = await response.json()
      setAssets(data)
    } catch (err) {
      setError(
        'Unable to load assets. Check that your backend is running on port 5000.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAssets()
  }, [])

  const filteredAssets = assets.filter((asset) => {
    const assetId = asset.assetTag || asset._id || ''

    const matchesSearch = [
      assetId,
      asset.name,
      asset.category,
      asset.assignedTo,
      asset.location,
    ]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())

    return (
      matchesSearch &&
      (filter === 'All' || asset.status === filter)
    )
  })

  const assigned = assets.filter(
    (asset) => asset.status === 'Assigned'
  ).length

  const available = assets.filter(
    (asset) => asset.status === 'Available'
  ).length

  const maintenance = assets.filter(
    (asset) => asset.status === 'Maintenance'
  ).length

  async function addAsset(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newAsset),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save the asset.')
      }

      setAssets((current) => [data.asset, ...current])
      setNewAsset({ ...emptyAsset })
      setShowForm(false)
      setSuccess('Asset registered successfully.')
    } catch (err) {
      setError(
        err.message || 'Could not save the asset. Please try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">A</div>
          <div>
            <strong>AssetFlow</strong>
            <span>IT MANAGEMENT</span>
          </div>
        </div>

        <p className="nav-heading">WORKSPACE</p>

        <button
          className="nav-item active"
          onClick={() => setFilter('All')}
        >
          <span>▦</span> Dashboard
        </button>

        <button
          className="nav-item"
          onClick={() => setFilter('All')}
        >
          <span>▤</span> Asset inventory
        </button>

        <button
          className="nav-item"
          onClick={() => setFilter('Assigned')}
        >
          <span>♙</span> Assignments
        </button>

        <button
          className="nav-item"
          onClick={() => setFilter('Maintenance')}
        >
          <span>⚙</span> Maintenance
        </button>

        <div className="sidebar-bottom">
          <div className="profile-avatar">IT</div>
          <div>
            <strong>IT Administrator</strong>
            <span>Ruimsig Campus</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">WORKSPACE / OVERVIEW</span>
            <h1>Asset dashboard</h1>
          </div>

          <button
            className="primary-button"
            onClick={() => {
              setShowForm(!showForm)
              setError('')
              setSuccess('')
            }}
          >
            + Add new asset
          </button>
        </header>

        <section className="welcome-panel">
          <div>
            <span className="welcome-tag">IT OPERATIONS</span>
            <h2>
              Know what you own.
              <br />
              Manage every asset.
            </h2>
            <p>
              Track your equipment, assignments and maintenance in one place.
            </p>
          </div>

          <div className="welcome-art" aria-hidden="true">
            ▥
          </div>
        </section>

        {error && (
          <div className="form-panel" role="alert">
            <strong>Something went wrong</strong>
            <p>{error}</p>
            <button className="secondary-button" onClick={loadAssets}>
              Retry loading assets
            </button>
          </div>
        )}

        {success && (
          <p role="status" className="success-message">
            {success}
          </p>
        )}

        <section className="stats-grid">
          <StatCard
            label="Total assets"
            value={assets.length}
            detail="All registered equipment"
            icon="▤"
          />
          <StatCard
            label="Assigned"
            value={assigned}
            detail="Currently in use"
            icon="♙"
          />
          <StatCard
            label="Available"
            value={available}
            detail="Ready to be assigned"
            icon="✓"
          />
          <StatCard
            label="In maintenance"
            value={maintenance}
            detail="Requires attention"
            icon="⚙"
          />
        </section>

        {showForm && (
          <section className="form-panel">
            <h2>Register an asset</h2>

            <form onSubmit={addAsset} className="asset-form">
              <label>
                Asset name
                <input
                  required
                  value={newAsset.name}
                  onChange={(e) =>
                    setNewAsset({
                      ...newAsset,
                      name: e.target.value,
                    })
                  }
                  placeholder="e.g. Lenovo Chromebook"
                />
              </label>

              <label>
                Category
                <select
                  value={newAsset.category}
                  onChange={(e) =>
                    setNewAsset({
                      ...newAsset,
                      category: e.target.value,
                    })
                  }
                >
                  <option>Chromebook</option>
                  <option>Laptop</option>
                  <option>Printer</option>
                  <option>Monitor</option>
                  <option>Networking</option>
                  <option>Other</option>
                </select>
              </label>

              <label>
                Assigned to
                <input
                  value={newAsset.assignedTo}
                  onChange={(e) =>
                    setNewAsset({
                      ...newAsset,
                      assignedTo: e.target.value,
                    })
                  }
                  placeholder="Person or department"
                />
              </label>

              <label>
                Location
                <input
                  required
                  value={newAsset.location}
                  onChange={(e) =>
                    setNewAsset({
                      ...newAsset,
                      location: e.target.value,
                    })
                  }
                  placeholder="e.g. IT Store"
                />
              </label>

              <label>
                Status
                <select
                  value={newAsset.status}
                  onChange={(e) =>
                    setNewAsset({
                      ...newAsset,
                      status: e.target.value,
                    })
                  }
                >
                  <option>Available</option>
                  <option>Assigned</option>
                  <option>Maintenance</option>
                  <option>Retired</option>
                </select>
              </label>

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save asset'}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="inventory-panel">
          <div className="inventory-header">
            <div>
              <h2>Asset inventory</h2>
              <p>Monitor and manage your registered equipment.</p>
            </div>

            <button
              className="secondary-button"
              onClick={() => {
                setSearch('')
                setFilter('All')
              }}
            >
              Reset filters
            </button>
          </div>

          <div className="toolbar">
            <input
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="⌕  Search assets..."
              aria-label="Search assets"
            />

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option>All</option>
              <option>Assigned</option>
              <option>Available</option>
              <option>Maintenance</option>
              <option>Retired</option>
            </select>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ASSET</th>
                  <th>ASSET ID</th>
                  <th>LOCATION</th>
                  <th>ASSIGNED TO</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="empty-state">
                      Loading assets from the database...
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredAssets.map((asset) => (
                      <tr key={asset._id || asset.assetTag}>
                        <td>
                          <div className="asset-name">
                            <span className="device-icon">▣</span>
                            <strong>{asset.name}</strong>
                          </div>
                          <span className="category-label">
                            {asset.category}
                          </span>
                        </td>

                        <td className="asset-id">
                          {asset.assetTag || asset._id}
                        </td>

                        <td>{asset.location}</td>
                        <td>{asset.assignedTo || '—'}</td>

                        <td>
                          <span
                            className={`status-badge ${(
                              asset.status || ''
                            ).toLowerCase()}`}
                          >
                            {asset.status}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {filteredAssets.length === 0 && (
                      <tr>
                        <td colSpan="5" className="empty-state">
                          No assets found. Try another search or add an asset.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          <footer className="table-footer">
            Showing {loading ? '—' : filteredAssets.length} of{' '}
            {loading ? '—' : assets.length} assets
            <span>Connected to MongoDB Atlas</span>
          </footer>
        </section>

        <p className="page-footer">
          AssetFlow · IT Asset Management · Portfolio project
        </p>
      </main>
    </div>
  )
}

function StatCard({ label, value, detail, icon }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-detail">{detail}</span>
    </article>
  )
}

export default App
